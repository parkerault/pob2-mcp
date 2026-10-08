#!/usr/bin/env node
// The build-guide run checker (slice 03 FR-W7). Node built-ins only (AC-B7): no dependency, no network.
//
//   node .claude/skills/build-guide/scripts/check-run.mjs <runFolder> [--partial]
//
// It validates a run folder against the run-folder layout (slice 03 §2), the run log (§6), the stage
// artifact formats and source markers (§7) and the guide template (§8). It doesn't trust self-reports: it
// recomputes the survival floor, the budget and the rolled-skill gate from the records, and counts claims
// itself, and wherever its result differs from the agents' verdict it fails, naming the part and both
// values. `--partial` accepts a run that ended before `completed` and checks what the run produced; it
// skips the V3/V4 claim-count comparisons when a step that writes claims ran after the last V3/V4 pass,
// since those reports describe earlier artifacts (D-262).
//
// Exit 0: every check passed (one line on stdout). Exit 1: each violation on stderr as
// `check-run: [<rule>] <message>`. Exit 2: usage error.
//
// The shapes it reads are documented in ../references/ (run-folder.md, run-log.md, source-markers.md,
// pricing.md); keep them in step with this file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The repo's C1/E1 data (C-35): .claude/skills/build-guide/scripts -> repo root -> data. */
const DATA_DIR = path.resolve(SCRIPT_DIR, '..', '..', '..', '..', 'data');

// ---------------------------------------------------------------------------------------------------
// Contracts (slice 03; spine C-30, C-31, C-33, D-219, D-234)
// ---------------------------------------------------------------------------------------------------

/** §8: the guide's H2s, in order. */
export const GUIDE_H2 = [
  'Versions, prices and import code',
  'Summary',
  'How it works',
  'Leveling',
  'Campaign rewards',
  'Endgame: budget variant',
  'Endgame: non-budget variant',
  'Rotation',
  'Defences and resistances',
  'FAQ and common mistakes',
  "Confidence and what PoB can't model",
  'Changelog',
  'Sources',
];
/** §7.2: the dossier's H2s, in order. */
export const DOSSIER_H2 = ['Roll and mode', 'Mechanics', 'Synergy search', 'Config gaps', 'Concepts', 'Not carried'];
const VARIANT_H2 = { budget: 'Endgame: budget variant', 'non-budget': 'Endgame: non-budget variant' };
const CONFIDENCE_H2 = "Confidence and what PoB can't model";

const SOURCE_KINDS = ['pob-computed', 'pob-data', 'external', 'judgment', 'external-unavailable'];
const EXTERNAL_UNAVAILABLE_REF = 'external source unavailable (offline run)';
const NEEDS_CONFIDENCE = ['external', 'judgment', 'external-unavailable'];
const OFFLINE_NOTE = 'offline run';

/** `TradeErrorKind` (src/trade/errors.ts), the `<kind>` of a `[trade:<kind>]` error prefix (D-218). */
const TRADE_KINDS = [
  'no_session', 'session_rejected', 'too_complex', 'invalid_query', 'rate_limited', 'locked_out',
  'would_wait', 'auth', 'http', 'network', 'timeout', 'disabled',
];
/** §4's set P: the only tools a price call names. */
const PRICE_TOOLS = ['get_item_price', 'search_trade_items', 'search_stats', 'get_leagues', 'trade_query_options', 'get_currency_rates'];

const RUN_LOG_FIELDS = [
  'schemaVersion', 'runFolder', 'slug', 'roll', 'mode', 'orchestration', 'testConfig', 'status', 'startedAt',
  'endedAt', 'caps', 'timeline', 'stages', 'agents', 'retries', 'rounds', 'concepts', 'conceptsCompiled',
  'v4Passes', 'checkpoints', 'escalations', 'revisions', 'pricing', 'faults', 'outputs',
];
const CAPS = { concepts: 3, lensesPerPass: 3, retriesPerStage: 2, fanOut: 3 };
const STAGES = ['R1a', 'R1b', 'R1b-assemble', 'dossier-fix', 'D1', 'D1-gate', 'D2', 'D2-gate', 'W1', 'V3', 'V4', 'revise-map'];
const OUTCOMES = ['pass', 'fail', 'infeasible', 'escalated', 'null-result', 'done'];
const STATUSES = ['running', 'completed', 'not-accepted', 'stopped', 'escalated'];
const CHOICES = ['accept', 'retry', 'checkpoint-1', 'stop'];
const LENSES = ['ledger', 'sources', 'prose'];
const OWNERS = ['W1', 'D1', 'D2', 'dossier-fix'];
const PARTS = ['pass', 'fail', 'unverified'];
const GATE_STAGES = ['R1b', 'D1-gate', 'D2-gate'];
const GATE_PARTS = { R1b: ['compiled'], 'D1-gate': ['compiled', 'v1', 'v2', 'floor', 'budget', 'rolledSkill'], 'D2-gate': ['compiled', 'v1', 'v2'] };
const ELEMENTS = ['Fire', 'Cold', 'Lightning'];
const HIT_OPTION = /^enemy(Physical|Fire|Cold|Lightning|Chaos)Damage$/;
/**
 * D-254: every endgame stage holds a waystone-scaled reference hit of each type, each derived by a ledger
 * entry. D-256: PoB takes these options as whole numbers, so the scenario value is the ledger value rounded
 * to 2 decimals (which absorbs float32 noise in the inputs), then rounded up.
 */
const HIT_TYPES = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'];
/** Steps that write the claims V3 and V4 count (plan.json, dossier.md, guide.md): D-262's stale-report test. */
const CLAIM_WRITERS = ['D1', 'D2', 'W1', 'dossier-fix'];
/** Findings that report on a passing part (../references/gates.md): never failures. */
const INFO_CODES = ['chaos-exception', 'near-ceiling'];

/** D-219: at most 20 divines passes; above 20 up to 22 passes with a "near the ceiling" note; above 22 fails. */
const BUDGET_CEILING = 20;
const BUDGET_TOLERANCE = 22;
const NEAR_CEILING = 'near the ceiling';

const SOURCES_COVERAGE = ['external', 'opened', 'data', 'dataChecked', 'pobDataEndgame', 'recheckedEndgame', 'pobDataOther', 'recheckedOther', 'prices', 'matched'];

// ---------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v, min = 0) => Number.isInteger(v) && v >= min;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isTime = (v) => typeof v === 'string' && ISO_TIME.test(v) && !Number.isNaN(Date.parse(v));
const ms = (v) => Date.parse(v);
const show = (v) => JSON.stringify(v);
const round2 = (x) => Math.round(x * 100) / 100;
/**
 * Whether a gate's basis copy `a` equals the record's value `b` to 2 decimals (|a − b| ≤ 0.005, plus a float
 * epsilon), as V4 compares: the same copy precision passes whatever the value's magnitude (WU-47 F7).
 */
const near = (a, b) => Math.abs(a - b) <= 0.005 + 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** D-256: the scenario value of a reference hit whose ledger entry has `value`. */
export const hitCeiling = (value) => Math.ceil(round2(value));
/** Whether `word` occurs in `text` as a whole token (not inside a longer word), case-insensitively. */
const hasWord = (text, word) =>
  typeof word === 'string' && word !== '' && new RegExp(`(?<![A-Za-z0-9_-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`, 'i').test(text);
const norm = (s) => String(s).replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

/** §2's slug: `<ascendancy>-<skill>` in lower case, each run outside [a-z0-9] one `-`, trimmed of `-`. */
export function slugOf(ascendancy, skill) {
  return `${ascendancy}-${skill}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

// ---------------------------------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------------------------------

export function checkRun(runFolder, { partial = false } = {}) {
  const violations = [];
  const fail = (rule, message) => violations.push({ rule, message });
  const abs = (rel) => path.join(runFolder, ...rel.split('/'));
  const exists = (rel) => fs.existsSync(abs(rel));
  const isDir = (rel) => exists(rel) && fs.statSync(abs(rel)).isDirectory();
  const listDir = (rel) => (isDir(rel) ? fs.readdirSync(abs(rel)).sort() : []);
  const readText = (rel) => (exists(rel) ? fs.readFileSync(abs(rel), 'utf8') : null);
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

  // ---- The run log (§6) ------------------------------------------------------------------------
  const log = readJson('run-log.json', 'run-log');
  if (!isObj(log)) {
    if (!exists('run-log.json')) fail('layout', 'run-log.json is missing; every run writes it from the start (FR-W2)');
    return violations;
  }
  checkRunLog(log, fail);
  const mode = log.mode;
  const offline = mode === 'offline';
  const completed = log.status === 'completed';
  if (!partial && !completed) {
    fail('status', `status is ${show(log.status)}; without --partial only a completed run passes`);
  }
  const runDir = typeof log.runFolder === 'string' ? log.runFolder.replace(/\\/g, '/').replace(/\/+$/, '') : '';
  const runName = runDir.split('/').slice(-2).join('-'); // <slug>-<YYYY-MM-DD>-<n>: the PoB file's build_name (§2)
  const runDate = (/(\d{4}-\d{2}-\d{2})-\d+$/.exec(runDir) ?? [])[1] ?? null;
  const stages = Array.isArray(log.stages) ? log.stages.filter(isObj) : [];
  const escalations = Array.isArray(log.escalations) ? log.escalations.filter(isObj) : [];

  // ---- Layout (§2) -----------------------------------------------------------------------------
  const KNOWN_TOP = ['run-log.json', 'research', 'concepts', 'dossier.md', 'plan.json', 'compile-record.json', 'compiled-build.xml', 'guide.md', 'reports'];
  for (const name of fs.readdirSync(runFolder)) {
    if (!KNOWN_TOP.includes(name)) fail('layout', `${name} isn't part of the run-folder layout (§2); agents write only the files §2 names`);
  }
  if (completed) {
    for (const rel of ['plan.json', 'compile-record.json', 'dossier.md', 'guide.md']) {
      if (!exists(rel)) fail('layout', `${rel} is missing; a completed run has plan.json, compile-record.json, dossier.md and guide.md (§2)`);
    }
  }
  const researchFiles = listDir('research');
  for (const f of researchFiles) {
    if (!/^p[1-9]\d*-r1a-[1-9]\d*\.md$/.test(f)) fail('layout', `research/${f} isn't named p<round>-r1a-<n>.md (§2)`);
  }
  if (completed && researchFiles.length === 0) fail('layout', 'research/ holds no p<round>-r1a-<n>.md file; R1a writes one per agent (§2)');

  // Plans: the run's own and the concept skeletons; prices and ledger ids resolve across them.
  const plan = readJson('plan.json');
  const conceptPlans = new Map();
  for (const id of listDir('concepts')) {
    if (!/^c[1-9]\d*$/.test(id) || !isDir(`concepts/${id}`)) {
      fail('layout', `concepts/${id} isn't a concept folder c<n> (§2)`);
      continue;
    }
    if (!exists(`concepts/${id}/plan.json`)) fail('layout', `concepts/${id}/plan.json is missing; R1b writes the concept's skeleton plan there (§2)`);
    const p = readJson(`concepts/${id}/plan.json`);
    if (p !== null) conceptPlans.set(id, p);
    for (const f of listDir(`concepts/${id}`)) {
      if (!['plan.json', 'compile-record.json', 'compiled-build.xml'].includes(f)) fail('layout', `concepts/${id}/${f} isn't part of the layout (§2)`);
    }
    const rec = readJson(`concepts/${id}/compile-record.json`);
    if (rec !== null) {
      // D-208: a skeleton compiles measure-only; its record names the XML beside it.
      const named = isObj(rec.pobFile) ? String(rec.pobFile.path ?? '') : '';
      if (rec.mode !== 'measure-only' || rec.pobFile?.location !== 'run') {
        fail('layout', `concepts/${id}/compile-record.json is a ${show(rec.mode)} compile; concept skeletons compile measure-only (D-208)`);
      } else if (!named.endsWith(`concepts/${id}/${path.posix.basename(named)}`) || !exists(`concepts/${id}/${path.posix.basename(named)}`)) {
        fail('layout', `concepts/${id}/compile-record.json names ${show(named)}, which isn't the compiled XML beside it (D-208)`);
      }
    }
  }
  const allPlans = [...(isObj(plan) ? [plan] : []), ...[...conceptPlans.values()].filter(isObj)];
  // D-261: pricing.totals.unavailable counts every unavailable prices[] entry of every plan the run wrote.
  const unavailable = allPlans.reduce((n, p) => n + (Array.isArray(p.prices) ? p.prices.filter((e) => isObj(e) && e.status === 'unavailable').length : 0), 0);
  const loggedUnavailable = isObj(log.pricing) && isObj(log.pricing.totals) ? log.pricing.totals.unavailable : undefined;
  if (isInt(loggedUnavailable) && loggedUnavailable !== unavailable) {
    fail('run-log', `run-log.json pricing.totals.unavailable: is ${loggedUnavailable}; plan.json and the concepts' plans hold ${unavailable} unavailable prices[] entries (D-261)`);
  }
  const ledgerIds = new Set(allPlans.flatMap((p) => (Array.isArray(p.ledger) ? p.ledger.map((e) => e?.id) : [])));
  const priceIds = new Set(allPlans.flatMap((p) => (Array.isArray(p.prices) ? p.prices.map((e) => e?.id) : [])));
  const record = readJson('compile-record.json');
  if (isObj(record) && record.mode === 'measure-only' && !exists('compiled-build.xml')) {
    fail('layout', "compile-record.json is a measure-only record, but compiled-build.xml isn't beside it (D-208)");
  }
  const planStages = isObj(plan) && Array.isArray(plan.stages) ? plan.stages.filter(isObj) : [];
  const endgame = planStages.filter((s) => s.variant !== undefined);
  const campaign = planStages.filter((s) => s.variant === undefined);

  // ---- Outputs and the final record (§2, §6 outputs) --------------------------------------------
  if (completed && isObj(record) && isObj(log.outputs)) {
    const o = log.outputs;
    if (record.mode !== 'final') fail('layout', `compile-record.json is a ${show(record.mode)} compile; a completed run ends with the final compile (§5.3)`);
    for (const k of ['plan', 'record', 'dossier', 'guide']) {
      if (typeof o[k] !== 'string' || !exists(o[k])) fail('run-log', `outputs.${k} is ${show(o[k])}, which names no file in the run folder`);
    }
    const pob = isObj(record.pobFile) ? record.pobFile : {};
    if (o.pobFile !== pob.path) fail('run-log', `outputs.pobFile is ${show(o.pobFile)}; the record's PoB file is ${show(pob.path)}`);
    const base = path.posix.basename(String(pob.path ?? '')).replace(/\.xml$/i, '');
    if (pob.location !== 'builds' || base !== runName) {
      fail('layout', `the final compile wrote ${show(pob.path)}; its build_name is "${runName}", the run folder's last two segments joined (§2)`);
    }
    const compiled = Array.isArray(record.stagesCompiled) ? record.stagesCompiled : [];
    for (const s of planStages) if (!compiled.includes(s.id)) fail('layout', `the final record didn't compile stage ${show(s.id)}`);
  }

  // ---- Offline mode (§11.1, D-233; AC-W2 k) -----------------------------------------------------
  if (offline) {
    const calls = Array.isArray(log.pricing?.calls) ? log.pricing.calls : [];
    if (calls.length > 0 || (isInt(log.pricing?.totals?.calls) && log.pricing.totals.calls > 0)) {
      fail('offline-prices', `an offline run made ${calls.length || log.pricing.totals.calls} price call(s); offline, no step calls a trade or poe.ninja tool (§11.1)`);
    }
    for (const [label, p] of [['plan.json', plan], ...[...conceptPlans].map(([id, cp]) => [`concepts/${id}/plan.json`, cp])]) {
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

  /** Claims of a plan (§7.4): one per stages[].claims[] entry, with its kind and whether it is endgame. */
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
          out.push({ kind: cite.kind, endgame: s.variant !== undefined, at: `stages[${i}].claims[${k}]` });
        } else {
          checkTag(where, c.source);
          out.push({ kind: c.source?.kind, endgame: s.variant !== undefined, at: `stages[${i}].claims[${k}]` });
        }
      });
    });
    return out;
  };

  /** Claims of a markdown artifact: one per definition line, in the section of its first marker. */
  const markdownClaims = (md, label, scope, isGuide) => {
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
      const first = md.markers.find((m) => m.id === d.id);
      const section = first ? md.h2Of(first.line) : null;
      out.push({ kind: parsed.kind, endgame: isGuide && typeof section === 'string' && section.startsWith('Endgame:'), id: d.id });
    }
    for (const m of md.markers) {
      if (!seen.has(m.id)) fail('markers', `${label}:${m.line + 1}: marker [^${m.id}] has no definition`);
    }
    return out;
  };

  const claims = { plan: [], dossier: [], guide: [] };
  if (isObj(plan)) claims.plan = planClaims(plan, 'plan.json');
  for (const [id, cp] of conceptPlans) planClaims(cp, `concepts/${id}/plan.json`);
  for (const f of researchFiles) {
    const text = readText(`research/${f}`);
    if (text !== null) markdownClaims(parseMarkdown(text), `research/${f}`, runScope, false);
  }

  // ---- Dossier (§7.2) --------------------------------------------------------------------------
  const dossierText = readText('dossier.md');
  if (dossierText !== null) {
    const md = parseMarkdown(dossierText);
    const titles = md.h2.map((h) => h.title);
    if (show(titles) !== show(DOSSIER_H2)) {
      fail('dossier-sections', `dossier.md's H2s are ${show(titles)}; §7.2 wants ${show(DOSSIER_H2)} in that order`);
    }
    const conceptsH2 = h2Named(md, 'Concepts');
    const h3 = conceptsH2 ? h3sUnder(md, conceptsH2).map((h) => h.title) : [];
    for (const c of Array.isArray(log.concepts) ? log.concepts.filter(isObj) : []) {
      if (c.status === 'not-carried') continue;
      if (!h3.some((t) => t.startsWith(`${c.id}: `))) fail('dossier-sections', `dossier.md's Concepts has no H3 "${c.id}: <title>" for concept ${c.id} (§7.2)`);
    }
    claims.dossier = markdownClaims(md, 'dossier.md', runScope, false);
  }

  // ---- Guide (§8) ------------------------------------------------------------------------------
  const guideText = readText('guide.md');
  let guide = null;
  const accepted = acceptedFindings(escalations);
  if (guideText !== null) {
    guide = parseMarkdown(guideText);
    const h1 = guide.headings.filter((h) => h.level === 1);
    const roll = isObj(log.roll) ? log.roll : {};
    if (h1.length !== 1) fail('guide-sections', `guide.md has ${h1.length} H1s; it has one, naming the roll (§8)`);
    else if (!norm(h1[0].title).includes(norm(roll.ascendancy ?? '')) || !norm(h1[0].title).includes(norm(roll.skill ?? ''))) {
      fail('guide-sections', `guide.md's H1 "${h1[0].title}" doesn't name the roll ${roll.ascendancy} / ${roll.skill}`);
    }
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
    const versions = h2Named(guide, GUIDE_H2[0]);
    if (versions && offline && !/offline/i.test(sectionText(guide, versions))) {
      fail('guide-sections', `guide.md's "${GUIDE_H2[0]}" doesn't say the run was offline (§8)`);
    }

    // (h) The import code equals the record's (D-205).
    if (versions) {
      const { start, end } = guide.sectionOf(versions);
      const block = guide.fences.find((f) => f.start > start && f.start < end);
      if (!block) fail('import-code', `guide.md's "${GUIDE_H2[0]}" has no fenced import code (§8)`);
      else if (isObj(record) && block.content.trim() !== String(record.importCode ?? '').trim()) {
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

    // Accepted failures (§5.4, §8): each accepted finding is listed under that H3, on one line with the
    // gate or report it failed (its code or id, and e.g. "D1-gate" or "V3").
    if (accepted.length > 0) {
      const conf = h2Named(guide, CONFIDENCE_H2);
      const h3 = conf ? h3sUnder(guide, conf).find((h) => h.title === 'Accepted failures') : null;
      const lines = h3 ? sectionText(guide, h3).split('\n') : [];
      if (!h3) fail('unresolved', `the user accepted ${accepted.length} finding(s) at an escalation, but guide.md has no "Accepted failures" H3 under "${CONFIDENCE_H2}" (§8)`);
      else {
        for (const a of accepted) {
          const key = a.id ?? a.code;
          if (!lines.some((l) => hasWord(l, key) && hasWord(l, a.gate))) {
            fail('unresolved', `guide.md's Accepted failures has no line naming accepted finding ${key} with its gate ${a.gate}${a.stage ? ` (stage ${a.stage})` : ''}`);
          }
        }
      }
    }

    claims.guide = markdownClaims(guide, 'guide.md', planScope(plan), true);
  }

  // ---- Reports (§2, §5.3, §7.4; FR-W6; AC-W2 l, m, n) ---------------------------------------------
  const reportFiles = listDir('reports');
  const gateFiles = listDir('reports/gates');
  const v3 = [];
  const v4 = [];
  for (const f of reportFiles) {
    if (f === 'gates') continue;
    let m;
    if ((m = /^v3-(c[1-9]\d*)-p([1-9]\d*)\.json$/.exec(f))) v3.push({ file: `reports/${f}`, concept: m[1], pass: Number(m[2]) });
    else if ((m = /^v4-(ledger|sources|prose)-(c[1-9]\d*)-p([1-9]\d*)\.json$/.exec(f))) v4.push({ file: `reports/${f}`, lens: m[1], concept: m[2], pass: Number(m[3]) });
    else fail('layout', `reports/${f} isn't named v3-<concept>-p<pass>.json or v4-<lens>-<concept>-p<pass>.json (§2)`);
  }
  const gates = [];
  for (const f of gateFiles) {
    const m = /^(R1b|D1-gate|D2-gate)-(c[1-9]\d*)-a([1-9]\d*)\.json$/.exec(f);
    if (!m) fail('layout', `reports/gates/${f} isn't named <stage>-<concept>-a<attempt>.json (§2)`);
    else gates.push({ file: `reports/gates/${f}`, stage: m[1], concept: m[2], attempt: Number(m[3]) });
  }
  // FR-W6, both ways: every gate verdict and V3/V4 report a step returned is persisted, and every file in
  // reports/ is one a logged step returned. The files are the evidence; the log only orders them.
  const logged = stages.filter((s) => s.outcome !== 'null-result');
  for (const s of logged) {
    if (GATE_STAGES.includes(s.stage) && !gates.some((g) => g.stage === s.stage && g.concept === s.concept && g.attempt === s.attempt)) {
      fail('reports', `run-log stages[] has ${s.stage} ${s.concept} attempt ${s.attempt}, but reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json is missing (FR-W6)`);
    }
    if (s.stage === 'V3' && !v3.some((r) => r.concept === s.concept && r.pass === s.pass)) {
      fail('reports', `run-log stages[] has V3 ${s.concept} pass ${s.pass}, but reports/v3-${s.concept}-p${s.pass}.json is missing (FR-W6)`);
    }
    if (s.stage === 'V4' && !v4.some((r) => r.concept === s.concept && r.pass === s.pass && r.lens === s.lens)) {
      fail('reports', `run-log stages[] has V4 ${s.lens} ${s.concept} pass ${s.pass}, but reports/v4-${s.lens}-${s.concept}-p${s.pass}.json is missing (FR-W6)`);
    }
  }
  for (const g of gates) {
    if (!logged.some((s) => s.stage === g.stage && s.concept === g.concept && s.attempt === g.attempt)) {
      fail('reports', `${g.file} has no run-log stages[] entry ${g.stage} ${g.concept} attempt ${g.attempt}; the log records every attempt (§6)`);
    }
  }
  for (const r of v3) {
    if (!logged.some((s) => s.stage === 'V3' && s.concept === r.concept && s.pass === r.pass)) {
      fail('reports', `${r.file} has no run-log stages[] entry V3 ${r.concept} pass ${r.pass}; the log records every attempt (§6)`);
    }
  }
  for (const r of v4) {
    if (!logged.some((s) => s.stage === 'V4' && s.lens === r.lens && s.concept === r.concept && s.pass === r.pass)) {
      fail('reports', `${r.file} has no run-log stages[] entry V4 ${r.lens} ${r.concept} pass ${r.pass}; the log records every attempt (§6)`);
    }
  }
  const gateReports = new Map();
  for (const g of gates) {
    const rep = readJson(g.file, 'gate-report');
    if (rep === null) continue;
    checkGateReport(rep, g, fail);
    gateReports.set(g.file, rep);
  }
  for (const r of [...v3, ...v4]) {
    r.report = readJson(r.file, 'report-shape');
    if (isObj(r.report)) checkReportShape(r.report, r, mode, fail);
  }
  const lastGate = (stage, concept) => gates.filter((g) => g.stage === stage && g.concept === concept).sort((a, b) => b.attempt - a.attempt)[0];

  // The concept the guide is for, from the report files: the only concept with D1 gate reports, or, when
  // several have them, the one whose D1 gate ran last (the log orders the files, which it must match).
  const d1Concepts = [...new Set(gates.filter((g) => g.stage === 'D1-gate').map((g) => g.concept))];
  let guideConcept = null;
  if (d1Concepts.length === 1) guideConcept = d1Concepts[0];
  else if (d1Concepts.length > 1) {
    const ordered = logged.filter((s) => s.stage === 'D1-gate' && d1Concepts.includes(s.concept));
    if (ordered.length > 0) guideConcept = ordered[ordered.length - 1].concept;
    else fail('reports', `D1 gate reports exist for ${d1Concepts.join(', ')}, and the run log doesn't say which ran last`);
  }
  const reported = [...new Set([...v3, ...v4].map((r) => r.concept))];
  if (completed) {
    if (guideConcept === null) fail('reports', 'no reports/gates/D1-gate-<concept>-a<n>.json; a completed run passed the D1 gate (§5.3)');
    else {
      if (!lastGate('D2-gate', guideConcept)) fail('reports', `no reports/gates/D2-gate-${guideConcept}-a<n>.json; a completed run passed the D2 gate (§5.3)`);
      for (const c of reported) {
        if (c !== guideConcept && !d1Concepts.includes(c)) fail('reports', `V3/V4 reports exist for ${c}, which has no D1 gate report`);
      }
    }
  }

  // Final-pass reports of that concept: (l) no unresolved finding, (m) the counts hold up.
  if (guideConcept !== null && (guideText !== null || completed)) {
    const mine3 = v3.filter((r) => r.concept === guideConcept && isObj(r.report));
    const mine4 = v4.filter((r) => r.concept === guideConcept && isObj(r.report));
    const final3 = mine3.sort((a, b) => b.pass - a.pass)[0];
    const final4 = LENSES.map((lens) => mine4.filter((r) => r.lens === lens).sort((a, b) => b.pass - a.pass)[0]);
    if (completed) {
      if (!final3) fail('reports', `no V3 report for ${guideConcept}; a completed run's guide passed V3 (§5.3)`);
      LENSES.forEach((lens, i) => {
        if (!final4[i]) fail('reports', `no V4 ${lens} report for ${guideConcept}; a completed run's guide passed every lens (§5.3)`);
      });
    }
    const finals = [final3, ...final4].filter(Boolean);
    const passes = [...new Set(finals.map((r) => r.pass))];
    if (passes.length > 1) fail('reports', `the final V3 and V4 reports of ${guideConcept} are from different passes ${show(passes)}; each round re-runs V3 and every lens (§5.5)`);
    // D-255: a run that ended escalated or stopped may hold unresolved findings its escalation recorded.
    const recorded = escalations.flatMap((e) => (Array.isArray(e.findings) ? e.findings.filter(isObj) : []).map((f) => ({ ...f, gate: typeof f.gate === 'string' ? f.gate : e.stage })));
    const endedEarly = partial && ['escalated', 'stopped'].includes(log.status);
    for (const r of finals) {
      for (const [i, f] of (Array.isArray(r.report.findings) ? r.report.findings.filter(isObj) : []).entries()) {
        if (f.status === 'accepted-offline') {
          // C-30, §7.4: accepted-offline only for a claim tagged external-unavailable, which the location names.
          const claim = claimAt(claims, f.artifact, f.location);
          if (!claim || claim.kind !== 'external-unavailable') {
            fail('report-shape', `${r.file}: findings[${i}] is accepted-offline, but ${show(f.artifact)} ${show(f.location)} names ${claim ? `a ${claim.kind} claim` : 'no claim'}; only a claim tagged external-unavailable is accepted offline (C-30)`);
          }
          continue;
        }
        if (f.status !== 'unresolved') continue;
        if (accepted.some((a) => sameReportFinding(a, f, r.report.stage))) continue;
        if (endedEarly && recorded.some((a) => sameReportFinding(a, f, r.report.stage))) continue;
        fail('unresolved', `${r.file}: finding ${show(f.id)} (${f.issue ?? 'no issue text'}) is unresolved in the final pass, and the user accepted no such finding (D-179)`);
      }
    }
    // D-262: in a run that ended early, a step that writes claims (a routed D1, D2, W1 or dossier-fix) may
    // have run after the last V3/V4 pass. Those reports counted the earlier artifacts, so under --partial
    // their counts aren't compared with the current ones; the reports' own consistency still is.
    const lastVerify = stages.reduce((at, s, i) => (['V3', 'V4'].includes(s.stage) ? i : at), -1);
    const stale = partial && !completed && lastVerify >= 0 && stages.slice(lastVerify + 1).some((s) => CLAIM_WRITERS.includes(s.stage));
    const counts = stale ? null : countClaims(claims, isObj(plan) ? plan : {});
    if (final3 && counts) checkV3Counts(final3, counts, fail);
    for (const r of final4.filter(Boolean)) checkV4Counts(r, counts, mode, fail);
  }

  // ---- The D1 gate, recomputed (FR-W7; §5.3; AC-W2 o, p, q) ---------------------------------------
  // A failure the user accepted at an escalation (same plan stage, part and code) fails nothing (§5.4).
  const covered = (f) => accepted.some((a) => a.code !== null && a.stage === (f.stage ?? null) && a.part === f.part && a.code === f.code);
  const ruleOf = (part) => (part === 'rolledSkill' ? 'rolled-skill' : ['floor', 'budget'].includes(part) ? part : 'gates');
  const d1 = guideConcept !== null ? lastGate('D1-gate', guideConcept) : undefined;
  const d1rep = d1 ? gateReports.get(d1.file) : null;
  if (d1 && isObj(d1rep) && isObj(d1rep.verdict)) {
    if (!isObj(plan)) fail('layout', `${d1.file} exists, but plan.json doesn't; the gate can't be recomputed`);
    else if (!isObj(record) || !isObj(record.stages)) fail('layout', `${d1.file} exists, but compile-record.json doesn't; the gate can't be recomputed`);
    else {
      const parts = {
        floor: recomputeFloor(endgame, record, d1rep, guide, fail),
        budget: recomputeBudget(endgame, plan, d1rep, guide, fail),
        rolledSkill: recomputeRolledSkill(endgame, plan, record, d1rep, fail),
      };
      for (const [part, got] of Object.entries(parts)) {
        const said = d1rep.verdict[part];
        const open = got.failures.filter((f) => !covered(f));
        const effective = open.length > 0 ? 'fail' : got.verdict === 'fail' ? (got.unverified ? 'unverified' : 'pass') : got.verdict;
        const why = got.failures.map((f) => f.why).join('; ');
        // The agents' verdict must agree with the records (accepted failures may be counted either way).
        if (said !== got.verdict && said !== effective) fail(ruleOf(part), `${d1.file} says ${part}: ${show(said)}, but the records give ${show(got.verdict)}${why ? `: ${why}` : ''}`);
        // A completed run's guide passed the gate: no recomputed failure stands unless accepted.
        if (completed) for (const f of open) fail(ruleOf(part), `the guide's concept fails the D1 gate's ${part} (${f.code}, stage ${f.stage}): ${f.why}; only a pass, or an unverified budget, proceeds to D2 (§5.3)`);
      }
    }
  }
  // A completed run's last D1 and D2 gates passed: a failing part stands only where accepted findings cover it.
  if (completed && guideConcept !== null) {
    for (const stage of ['D1-gate', 'D2-gate']) {
      const g = lastGate(stage, guideConcept);
      const rep = g ? gateReports.get(g.file) : null;
      if (!isObj(rep) || !isObj(rep.verdict)) continue;
      for (const part of GATE_PARTS[stage]) {
        if (rep.verdict[part] !== 'fail') continue;
        const findings = (Array.isArray(rep.findings) ? rep.findings.filter(isObj) : []).filter((f) => f.part === part && !INFO_CODES.includes(f.code));
        const open = findings.filter((f) => !covered(f));
        if (part === 'compiled' || findings.length === 0 || open.length > 0) {
          fail(ruleOf(part), `${g.file} says ${part}: "fail"${open.length > 0 ? ` (${open.map((f) => f.code).join(', ')})` : ''}, and no accepted finding covers it; a completed run's guide passed this gate (§5.3, §5.4)`);
        }
      }
    }
  }

  // ---- The final record's checks (§5.3 D2 gate; C-33) ----------------------------------------------
  if (completed && isObj(record) && isObj(record.stages)) {
    for (const [id, st] of Object.entries(record.stages)) {
      for (const check of ['v1', 'v2']) {
        const verdict = st?.[check];
        if (!isObj(verdict)) {
          fail('record-verdicts', `the final record's stage ${id} has no ${check.toUpperCase()} verdict (D-192)`);
          continue;
        }
        const open = (Array.isArray(verdict.findings) ? verdict.findings : []).filter((f) => !covered({ stage: id, part: check, code: f?.code }));
        if (open.length > 0) fail('record-verdicts', `the final record's stage ${id} fails ${check.toUpperCase()}: ${open.map((f) => f?.code).join(', ')}`);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------------------------------
// The run log (§6)
// ---------------------------------------------------------------------------------------------------

function checkRunLog(log, fail) {
  for (const k of RUN_LOG_FIELDS) if (!(k in log)) fail('run-log', `run-log.json has no ${k} (§6)`);
  const bad = (field, why) => fail('run-log', `run-log.json ${field}: ${why}`);
  if ('schemaVersion' in log && log.schemaVersion !== 1) bad('schemaVersion', `is ${show(log.schemaVersion)}; it is 1`);
  const roll = log.roll;
  if ('roll' in log && !(isObj(roll) && typeof roll.ascendancy === 'string' && typeof roll.skill === 'string')) bad('roll', 'is {ascendancy, skill}');
  if (isObj(roll) && 'slug' in log && log.slug !== slugOf(roll.ascendancy ?? '', roll.skill ?? '')) {
    bad('slug', `is ${show(log.slug)}; the roll's slug is "${slugOf(roll.ascendancy ?? '', roll.skill ?? '')}" (§2)`);
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
  oneOf('orchestration', ['workflow', 'agent-tool']);
  oneOf('testConfig', ['none', 'accepted', 'refused']);
  oneOf('status', STATUSES);
  if (log.testConfig === 'accepted' && log.mode !== 'offline') bad('testConfig', 'is "accepted" in an online run; a test config is accepted only with --offline (§11.2)');
  if ('startedAt' in log && !isTime(log.startedAt)) bad('startedAt', `${show(log.startedAt)} isn't an ISO 8601 UTC time`);
  if ('endedAt' in log) {
    if (log.status === 'running' ? log.endedAt !== null && !isTime(log.endedAt) : !isTime(log.endedAt)) {
      bad('endedAt', `${show(log.endedAt)}: a run that ended has an ISO 8601 UTC endedAt; a running one has null`);
    } else if (isTime(log.startedAt) && isTime(log.endedAt) && ms(log.endedAt) < ms(log.startedAt)) bad('endedAt', 'is before startedAt');
  }
  if ('caps' in log && show(log.caps) !== show(CAPS)) bad('caps', `is ${show(log.caps)}; it is ${show(CAPS)} (D-127, D-161)`);

  const list = (field) => {
    if (!(field in log)) return [];
    if (!Array.isArray(log[field])) {
      bad(field, 'is a list');
      return [];
    }
    return log[field];
  };
  let previous = null;
  list('timeline').forEach((t, i) => {
    if (!isObj(t) || typeof t.what !== 'string' || !isTime(t.startedAt) || !isTime(t.endedAt)) return bad(`timeline[${i}]`, 'is {what, startedAt, endedAt} with ISO times');
    if (ms(t.endedAt) < ms(t.startedAt)) bad(`timeline[${i}]`, 'ends before it starts');
    if (previous !== null && ms(t.startedAt) < previous) bad(`timeline[${i}]`, 'starts before the entry above it; the timeline is in order');
    previous = ms(t.startedAt);
  });
  list('stages').forEach((s, i) => {
    const at = `stages[${i}]`;
    if (!isObj(s)) return bad(at, 'is an object');
    if (!STAGES.includes(s.stage)) bad(at, `stage ${show(s.stage)} isn't one of ${STAGES.join(', ')}`);
    if (!isInt(s.attempt, 1)) bad(at, 'attempt is an integer from 1');
    if (!OUTCOMES.includes(s.outcome)) bad(at, `outcome ${show(s.outcome)} isn't one of ${OUTCOMES.join(', ')}`);
    if (!isInt(s.findings)) bad(at, 'findings is a count');
    if (!isInt(s.agents)) bad(at, 'agents is a count');
    if (s.stage === 'V4' && !LENSES.includes(s.lens)) bad(at, `a V4 entry names its lens (${LENSES.join(', ')})`);
    for (const k of ['startedAt', 'endedAt']) {
      if (s[k] !== null && !isTime(s[k])) bad(at, `${k} is null or an ISO time`);
      if (log.orchestration === 'agent-tool' && s[k] === null) bad(at, `${k} is null; in agent-tool mode the skill runner stamps every attempt (§6)`);
    }
    if (isTime(s.startedAt) && isTime(s.endedAt) && ms(s.endedAt) < ms(s.startedAt)) bad(at, 'ends before it starts');
  });
  if ('agents' in log) {
    const a = log.agents;
    if (!isObj(a) || !isInt(a.total) || !isObj(a.byType) || !isInt(a.maxConcurrent)) bad('agents', 'is {total, byType, maxConcurrent}');
    else if (a.maxConcurrent > CAPS.fanOut) fail('caps', `agents.maxConcurrent is ${a.maxConcurrent}; fan-out is at most ${CAPS.fanOut} (NFR-23, D-161)`);
  }
  // §6: one entry per key (stage, concept, round, researcher), a missing field counting as null. The
  // research workflow's entries carry their round, so two rounds' retries of one step stay apart.
  const retryKeys = new Map();
  list('retries').forEach((r, i) => {
    if (!isObj(r) || typeof r.stage !== 'string' || !isInt(r.count)) return bad(`retries[${i}]`, 'is {stage, concept, round?, researcher?, count}');
    for (const k of ['round', 'researcher']) {
      if (k in r && r[k] !== null && !isInt(r[k], 1)) bad(`retries[${i}]`, `${k} is ${show(r[k])}; an integer from 1`);
    }
    const key = show([r.stage, r.concept ?? null, r.round ?? null, r.researcher ?? null]);
    if (retryKeys.has(key)) bad(`retries[${i}]`, `repeats the key (stage, concept, round, researcher) ${key} of retries[${retryKeys.get(key)}]; equal keys merge into one entry (§6)`);
    else retryKeys.set(key, i);
    const who = [r.concept, r.round !== undefined && r.round !== null ? `round ${r.round}` : null, r.researcher ? `researcher ${r.researcher}` : null].filter(Boolean).join(' ');
    if (r.count > CAPS.retriesPerStage) fail('caps', `retries[${i}]: ${r.stage} ${who} has ${r.count} retries; at most ${CAPS.retriesPerStage} per stage (NFR-23, D-127)`);
  });
  let compiledSum = 0;
  list('rounds').forEach((r, i) => {
    if (!isObj(r) || !isInt(r.round, 1) || !isInt(r.firstId, 1) || !Array.isArray(r.concepts) || !isInt(r.conceptsCompiled)) {
      return bad(`rounds[${i}]`, 'is {round, note, firstId, concepts, conceptsCompiled, startedBy}');
    }
    compiledSum += r.conceptsCompiled;
    if (!['user', 'pre-supplied'].includes(r.startedBy)) bad(`rounds[${i}]`, 'startedBy is "user" or "pre-supplied"');
    if (r.startedBy === 'pre-supplied' && log.testConfig !== 'accepted') bad(`rounds[${i}]`, 'is pre-supplied without an accepted test config (A-28)');
    if (r.conceptsCompiled > CAPS.concepts) fail('caps', `rounds[${i}] compiled ${r.conceptsCompiled} concepts; at most ${CAPS.concepts} per research round (NFR-23, D-235)`);
  });
  const ids = new Set();
  list('concepts').forEach((c, i) => {
    if (!isObj(c) || !/^c[1-9]\d*$/.test(c.id ?? '') || !['viable', 'failed', 'not-carried'].includes(c.status)) {
      return bad(`concepts[${i}]`, 'is {id: c<n>, title, round, status: viable | failed | not-carried, attempts}');
    }
    if (ids.has(c.id)) bad(`concepts[${i}]`, `id ${c.id} is used twice; ids are unique across rounds`);
    ids.add(c.id);
  });
  if ('conceptsCompiled' in log && log.conceptsCompiled !== compiledSum) {
    bad('conceptsCompiled', `is ${show(log.conceptsCompiled)}; the rounds compiled ${compiledSum}`);
  }
  list('v4Passes').forEach((p, i) => {
    if (!isObj(p) || !isInt(p.pass, 1) || !isInt(p.lenses)) return bad(`v4Passes[${i}]`, 'is {concept, pass, lenses}');
    if (p.lenses > CAPS.lensesPerPass) fail('caps', `v4Passes[${i}] ran ${p.lenses} lenses; at most ${CAPS.lensesPerPass} per pass (NFR-23, D-127)`);
  });
  list('checkpoints').forEach((c, i) => {
    const at = `checkpoints[${i}]`;
    if (!isObj(c)) return bad(at, 'is an object');
    if (![1, 2, 'unsaved-build', 'escalation'].includes(c.checkpoint)) bad(at, `checkpoint ${show(c.checkpoint)} isn't 1, 2, "unsaved-build" or "escalation"`);
    if (!isInt(c.visit, 1)) bad(at, 'visit is an integer from 1');
    if (!['user', 'pre-supplied', 'default'].includes(c.answeredBy)) bad(at, 'answeredBy is "user", "pre-supplied" or "default"');
    if (c.answeredBy !== 'user' && log.testConfig !== 'accepted') {
      bad(at, `answeredBy is ${show(c.answeredBy)} without an accepted test config; outside offline test mode the user answers (A-28, D-157)`);
    }
    if (typeof c.shown !== 'string' || typeof c.answer !== 'string' || !isTime(c.at)) bad(at, 'has shown, answer and an ISO time at');
  });
  list('escalations').forEach((e, i) => {
    if (!isObj(e) || typeof e.stage !== 'string' || !Array.isArray(e.findings) || !CHOICES.includes(e.choice)) {
      return bad(`escalations[${i}]`, `is {stage, concept, attempts, findings: [...], choice: ${CHOICES.join(' | ')}, guidance?}`);
    }
    e.findings.forEach((f, k) => {
      if (isObj(f) && typeof f.id === 'string' && (typeof f.artifact !== 'string' || typeof f.location !== 'string')) {
        bad(`escalations[${i}].findings[${k}]`, 'is a V3/V4 finding without its artifact and location; it is recorded verbatim, and only an equal finding (same id, artifact and location) is the same (§5.4)');
      }
      if (!isObj(f) || typeof f.gate !== 'string' || (typeof f.code !== 'string' && typeof f.id !== 'string')) {
        bad(`escalations[${i}].findings[${k}]`, 'is the finding as its verdict or report has it (a gate finding with part, code and plan stage; a V3/V4 finding with id), plus gate');
      }
    });
  });
  list('revisions').forEach((r, i) => {
    if (!isObj(r) || !isInt(r.round, 1) || !Array.isArray(r.requests)) bad(`revisions[${i}]`, 'is {round, requests: [{text, owner}]}');
  });
  if ('pricing' in log) {
    const p = log.pricing;
    if (!isObj(p) || !Array.isArray(p.calls) || !isObj(p.totals)) bad('pricing', 'is {calls: [...], totals}');
    else {
      const count = { ok: 0, would_wait: 0, locked_out: 0, rate_limited: 0 };
      p.calls.forEach((c, i) => {
        const at = `pricing.calls[${i}]`;
        if (!isObj(c)) return bad(at, 'is {at, stage, tool, item, outcome}');
        if (!['ok', 'error', ...TRADE_KINDS].includes(c.outcome)) bad(at, `outcome ${show(c.outcome)} is ok, error or a [trade:<kind>] kind (D-218)`);
        if (!PRICE_TOOLS.includes(c.tool)) bad(at, `tool ${show(c.tool)} isn't a price tool (§4 set P)`);
        if (c.outcome === 'ok' ? !isTime(c.at) : c.at !== null) bad(at, "at is the result's Checked: time for ok, null for an error (§6)");
        if (c.outcome in count) count[c.outcome] += 1;
      });
      const t = p.totals;
      const want = { calls: p.calls.length, ok: count.ok, wouldWait: count.would_wait, lockedOut: count.locked_out, rateLimited: count.rate_limited };
      for (const [k, n] of Object.entries(want)) if (t[k] !== n) bad(`pricing.totals.${k}`, `is ${show(t[k])}; the calls give ${n}`);
      if (!isInt(t.unavailable)) bad('pricing.totals.unavailable', 'is a count');
      if (count.rate_limited > 0 || count.locked_out > 0) {
        fail('nfr-22', `pricing hit ${count.rate_limited} rate_limited and ${count.locked_out} locked_out outcome(s); NFR-22 wants zero of each`);
      }
    }
  }
  list('faults').forEach((f, i) => {
    if (!isObj(f) || !['FI-1', 'FI-2', 'FI-3'].includes(f.id)) bad(`faults[${i}]`, 'is {id: FI-1 | FI-2 | FI-3, target, applied, observed}');
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

/**
 * Findings the user accepted at an escalation (§5.4), as the run log records them: each verbatim from its
 * verdict or report, plus `gate`, the gate or report it failed (`D1-gate`, `D2-gate`, `V3`, `V4`, …).
 * A gate finding is equal to another with the same plan `stage`, `part` and `code`, whichever gate
 * reports it; a V3/V4 finding by its `id` and report stage.
 */
/**
 * A V3/V4 finding equals an accepted (or recorded) one only when it is the same finding (§5.4): the same report,
 * id and artifact, and the same location, a "<H2 title>, line <n>" location compared by its section alone (a
 * regenerated guide moves its lines). A reused id on another issue is a new finding.
 */
const locationKey = (loc) => (typeof loc === 'string' ? loc.trim().replace(/,\s*line\s+\d+$/i, '') : null);
function sameReportFinding(a, f, stage) {
  return (
    typeof a.id === 'string' && a.id === f.id && a.gate === stage &&
    typeof a.artifact === 'string' && a.artifact === f.artifact && locationKey(a.location) === locationKey(f.location)
  );
}

/** The claim a V3/V4 finding's location names: a plan claim `stages[i].claims[k]`, or a markdown `[^id]`. */
function claimAt(claims, artifact, location) {
  if (typeof location !== 'string') return null;
  if (artifact === 'plan.json') {
    const m = /stages\[\d+\]\.claims\[\d+\]/.exec(location);
    return m ? (claims.plan.find((c) => c.at === m[0]) ?? null) : null;
  }
  const list = artifact === 'guide.md' ? claims.guide : artifact === 'dossier.md' ? claims.dossier : null;
  const m = /\[\^([^\]\s]+)\]/.exec(location);
  return list && m ? (list.find((c) => c.id === m[1]) ?? null) : null;
}

function acceptedFindings(escalations) {
  const out = [];
  for (const e of escalations) {
    if (e.choice !== 'accept' || !Array.isArray(e.findings)) continue;
    for (const f of e.findings.filter(isObj)) {
      const a = {
        gate: typeof f.gate === 'string' ? f.gate : typeof e.stage === 'string' ? e.stage : null,
        stage: typeof f.stage === 'string' ? f.stage : null,
        part: typeof f.part === 'string' ? f.part : null,
        code: typeof f.code === 'string' ? f.code : null,
        id: typeof f.id === 'string' ? f.id : null,
        artifact: typeof f.artifact === 'string' ? f.artifact : null,
        location: typeof f.location === 'string' ? f.location : null,
      };
      if (a.code !== null || a.id !== null) out.push(a);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Reports (§5.3 gate verdicts, §7.4 V3 and V4)
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
    if (!isObj(b) || !Array.isArray(b.floor) || !isObj(b.budget) || !Array.isArray(b.rolledSkill)) {
      bad("has no basis {floor: [...], budget: {...}, rolledSkill: [...]}: what the run checker recomputes the verdict from (§5.3)");
    }
  }
}

function checkReportShape(rep, r, mode, fail) {
  const bad = (why) => fail('report-shape', `${r.file}: ${why}`);
  const stage = r.lens ? 'V4' : 'V3';
  if (rep.stage !== stage) bad(`stage is ${show(rep.stage)}; it is "${stage}"`);
  if (stage === 'V4' && rep.lens !== r.lens) bad(`lens is ${show(rep.lens)}; its name says "${r.lens}"`);
  if (rep.concept !== r.concept) bad(`concept is ${show(rep.concept)}; its name says "${r.concept}"`);
  if (rep.pass !== r.pass) bad(`pass is ${show(rep.pass)}; its name says ${r.pass}`);
  if (rep.mode !== mode) bad(`mode is ${show(rep.mode)}; the run is ${show(mode)}`);
  if (!isObj(rep.coverage)) bad('has no coverage object (§7.4)');
  if (!Array.isArray(rep.findings)) return bad('has no findings list (§7.4)');
  if (!['pass', 'fail'].includes(rep.verdict)) bad(`verdict is ${show(rep.verdict)}; "pass" or "fail" (§7.4)`);
  let unresolved = 0;
  rep.findings.forEach((f, i) => {
    if (!isObj(f)) return bad(`findings[${i}] is an object`);
    for (const k of ['id', 'artifact', 'location', 'claim', 'issue', 'evidence', 'owner', 'status']) {
      if (!(k in f)) bad(`findings[${i}] has no ${k} (§7.4)`);
    }
    if (!['unresolved', 'accepted-offline'].includes(f.status)) bad(`findings[${i}].status is ${show(f.status)}; "unresolved" or "accepted-offline"`);
    if (f.status === 'accepted-offline' && mode !== 'offline') bad(`findings[${i}] is accepted-offline in an online run; only offline mode accepts external-unavailable (C-30)`);
    if (f.status === 'accepted-offline' && r.lens !== 'sources') bad(`findings[${i}] is accepted-offline in a ${r.lens ? `${r.lens} lens` : 'V3'} report; only the V4 sources lens marks an external-unavailable claim accepted-offline (C-30, §7.4)`);
    if ('owner' in f && !OWNERS.includes(f.owner)) bad(`findings[${i}].owner is ${show(f.owner)}; one of ${OWNERS.join(', ')} (§5.5)`);
    if (f.status === 'unresolved') unresolved += 1;
  });
  if (rep.verdict === 'pass' && unresolved > 0) bad(`says verdict "pass" alongside ${unresolved} unresolved finding(s); pass means none is unresolved (§7.4)`);
  if (rep.verdict === 'fail' && unresolved === 0) bad('says verdict "fail" with no unresolved finding; pass means none is unresolved (§7.4)');
  const need = stage === 'V3' ? ['plan', 'dossier', 'guide'] : r.lens === 'ledger' ? ['entries', 'rederived'] : r.lens === 'sources' ? SOURCES_COVERAGE : [];
  if (isObj(rep.coverage)) for (const k of need) if (!isInt(rep.coverage[k])) bad(`coverage.${k} is ${show(rep.coverage[k])}; a count (§7.4)`);
}

/** The checker's own claim counts (§7.4). */
function countClaims(claims, plan) {
  const all = [...claims.plan, ...claims.dossier, ...claims.guide];
  const pobData = all.filter((c) => c.kind === 'pob-data');
  return {
    plan: claims.plan.length,
    dossier: claims.dossier.length,
    guide: claims.guide.length,
    external: all.filter((c) => c.kind === 'external').length,
    data: all.filter((c) => c.kind === 'data').length,
    pobDataEndgame: pobData.filter((c) => c.endgame).length,
    pobDataOther: pobData.filter((c) => !c.endgame).length,
    prices: all.filter((c) => c.kind === 'price').length,
    entries: Array.isArray(plan.ledger) ? plan.ledger.length : 0,
  };
}

function checkV3Counts(r, counts, fail) {
  const cov = r.report.coverage;
  if (!isObj(cov)) return;
  for (const k of ['plan', 'dossier', 'guide']) {
    if (cov[k] !== counts[k]) fail('claim-counts', `${r.file}: coverage.${k} is ${show(cov[k])}, but the checker counts ${counts[k]} claims in that artifact (§7.4)`);
  }
}

/**
 * A V4 report's coverage against the checker's own counts. With `counts` null (D-262: the report counted
 * artifacts a later step rewrote), only the checks within the report itself apply.
 */
function checkV4Counts(r, counts, mode, fail) {
  const cov = r.report.coverage;
  if (!isObj(cov)) return;
  const said = (k, n) => {
    if (cov[k] !== n) fail('claim-counts', `${r.file}: coverage.${k} is ${show(cov[k])}, but the checker counts ${n} (§7.4)`);
  };
  if (r.lens === 'ledger') {
    if (counts) said('entries', counts.entries);
    if (cov.rederived !== cov.entries) fail('claim-counts', `${r.file}: rederived ${show(cov.rederived)} of ${show(cov.entries)} ledger entries; V4 re-derives every entry (D-179)`);
  }
  if (r.lens === 'sources') {
    // Online V4 opens every external source (D-179); offline it opens none (D-201, D-255).
    if (mode === 'offline' && cov.opened !== 0) fail('claim-counts', `${r.file}: opened ${show(cov.opened)} sources in an offline run; offline V4 opens none (D-201)`);
    if (!counts) return;
    for (const k of ['external', 'data', 'pobDataEndgame', 'pobDataOther', 'prices']) said(k, counts[k]);
    if (mode !== 'offline' && cov.opened !== counts.external) fail('claim-counts', `${r.file}: opened ${show(cov.opened)} of ${counts.external} external claims; V4 opens every external source (D-179)`);
    if (cov.dataChecked !== counts.data) fail('claim-counts', `${r.file}: checked ${show(cov.dataChecked)} of ${counts.data} data claims; V4 checks every one (§7.4)`);
    if (!(isInt(cov.recheckedEndgame) && cov.recheckedEndgame >= counts.pobDataEndgame)) {
      fail('claim-counts', `${r.file}: re-checked ${show(cov.recheckedEndgame)} of ${counts.pobDataEndgame} endgame pob-data claims; D-179 wants all of them`);
    }
    const min = Math.ceil(counts.pobDataOther / 5);
    if (!(isInt(cov.recheckedOther) && cov.recheckedOther >= min)) {
      fail('claim-counts', `${r.file}: re-checked ${show(cov.recheckedOther)} of ${counts.pobDataOther} pob-data claims elsewhere; D-179 wants at least 1 in 5 (${min})`);
    }
    if (isInt(cov.matched) && cov.matched > counts.prices) fail('claim-counts', `${r.file}: matched ${cov.matched} price claims of ${counts.prices}`);
  }
}

// ---------------------------------------------------------------------------------------------------
// The D1 gate, recomputed (§5.3)
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
 * Survival floor (D-118, D-119, D-234, D-254, D-256): all four resistances capped (chaos only by the
 * exception); the five waystone-scaled reference hits present, each the whole-number ceiling of its ledger
 * entry; max hits above the hits. The gate's basis copies are compared with the record to 2 decimals.
 */
function recomputeFloor(endgame, record, rep, guide, fail) {
  const failures = [];
  const basis = Array.isArray(rep.basis?.floor) ? rep.basis.floor.filter(isObj) : [];
  for (const s of endgame) {
    const out = record.stages[s.id]?.outputs;
    if (!isObj(out)) {
      failures.push(failure('floor', s.id, 'stage-not-compiled', `stage ${s.id} isn't in the record`));
      continue;
    }
    const b = basis.find((x) => x.stage === s.id);
    if (!b) fail('gate-report', `the D1 gate's basis.floor has no entry for endgame stage ${s.id} (§5.3)`);
    for (const e of ELEMENTS) {
      const v = out[`Missing${e}Resist`];
      const code = `missing-${e.toLowerCase()}-resist`;
      if (!isNum(v)) failures.push(failure('floor', s.id, code, `stage ${s.id} has no Missing${e}Resist in the record`));
      else if (v > 0) failures.push(failure('floor', s.id, code, `stage ${s.id} Missing${e}Resist is ${v}`));
      const said = b?.missing?.[e];
      if (b && isNum(v) && !(isNum(said) && near(said, v))) fail('floor', `the D1 gate's basis gives stage ${s.id} Missing${e}Resist ${show(said)}; the record has ${v}`);
    }
    const chaos = out.MissingChaosResist;
    if (!isNum(chaos)) failures.push(failure('floor', s.id, 'missing-chaos-resist', `stage ${s.id} has no MissingChaosResist in the record`));
    else {
      if (b && !(isNum(b.chaos) && near(b.chaos, chaos))) fail('floor', `the D1 gate's basis gives stage ${s.id} MissingChaosResist ${show(b.chaos)}; the record has ${chaos}`);
      if (chaos > 0) {
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
    }
    for (const opt of scenario) {
      const m = HIT_OPTION.exec(opt.option ?? '');
      if (!m || !isNum(opt.value) || opt.value <= 0) continue;
      const code = `max-hit-${m[1].toLowerCase()}`;
      const max = out[`${m[1]}MaximumHitTaken`];
      if (!isNum(max)) failures.push(failure('floor', s.id, code, `stage ${s.id} has no ${m[1]}MaximumHitTaken in the record`));
      else if (!(max > opt.value)) failures.push(failure('floor', s.id, code, `stage ${s.id} ${m[1]}MaximumHitTaken ${max} isn't above the ${opt.option} hit ${opt.value}`));
      const said = Array.isArray(b?.hits) ? b.hits.find((h) => h?.type === m[1]) : undefined;
      if (b && !said) fail('gate-report', `the D1 gate's basis.floor for stage ${s.id} has no ${m[1]} hit; the plan's scenario sets ${opt.option} (§5.3)`);
      else if (said && isNum(max) && !(near(said.hit, opt.value) && near(said.maxHitTaken, max))) {
        fail('floor', `the D1 gate's basis gives stage ${s.id}'s ${m[1]} hit ${show(said.hit)} against ${show(said.maxHitTaken)}; the records give ${opt.value} against ${max}`);
      }
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : 'pass', failures };
}

/**
 * Budget (D-116, D-164, D-219, D-249) from the plan's prices, the gate's map from filled slots and tree
 * jewels to price entries, and its recorded rates. Totals are compared rounded to 2 decimals.
 */
function recomputeBudget(endgame, plan, rep, guide, fail) {
  const failures = [];
  const b = isObj(rep.basis?.budget) ? rep.basis.budget : {};
  const maps = Array.isArray(b.slots) ? b.slots.filter(isObj) : [];
  const rates = new Map((Array.isArray(b.rates) ? b.rates.filter(isObj) : []).map((r) => [String(r.currency).toLowerCase(), r.divines]));
  const totals = Array.isArray(b.totals) ? b.totals.filter(isObj) : [];
  const prices = new Map((Array.isArray(plan.prices) ? plan.prices.filter(isObj) : []).map((p) => [p.id, p]));
  let unverified = false;
  for (const s of endgame.filter((x) => x.variant === 'budget')) {
    const filled = [
      ...(Array.isArray(s.items?.slots) ? s.items.slots.filter(isObj) : []).map((it) => ({ what: `slot "${it.slot}"`, slot: it.slot, text: it.text })),
      ...(Array.isArray(s.items?.treeJewels) ? s.items.treeJewels.filter(isObj) : []).map((j) => ({ what: `tree jewel in node ${j.node}`, jewel: j.node, text: j.text })),
    ];
    let total = 0;
    let stageUnverified = false;
    const used = new Map();
    for (const it of filled) {
      const map = maps.find((x) => x.stage === s.id && (it.slot !== undefined ? x.slot === it.slot : x.jewel === it.jewel));
      const price = map ? prices.get(map.priceId) : undefined;
      if (!price) {
        fail('budget', `budget stage ${s.id}'s filled ${it.what} maps to no prices[] entry${map ? ` (the gate names ${show(map.priceId)})` : ''}; every filled slot and tree jewel is priced (§5.3, D-249)`);
        stageUnverified = true;
        continue;
      }
      if (used.has(map.priceId) && used.get(map.priceId).text !== it.text) {
        fail('budget', `budget stage ${s.id}'s ${it.what} and ${used.get(map.priceId).what} share price entry ${show(map.priceId)} but hold different items; each has its own entry unless the item text is identical`);
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
    const said = totals.find((t) => t.stage === s.id);
    if (!said) fail('gate-report', `the D1 gate's basis.budget has no total for budget stage ${s.id} (§5.3)`);
    else if (!(mine === null ? said.divines === null : isNum(said.divines) && round2(said.divines) === mine)) {
      fail('budget', `the D1 gate's total for budget stage ${s.id} is ${show(said.divines)} divines; the plan's prices and its rates give ${mine === null ? 'null (unverified)' : mine}`);
    }
    if (mine === null) unverified = true;
    else if (mine > BUDGET_TOLERANCE) failures.push(failure('budget', s.id, 'over-budget', `stage ${s.id} totals ${mine} divines, above ${BUDGET_TOLERANCE} (D-219)`));
    else if (mine > BUDGET_CEILING) {
      const text = checksText(guide, 'budget');
      if (guide && !(text !== null && norm(text).includes(NEAR_CEILING))) {
        fail('budget', `budget stage ${s.id} totals ${mine} divines, over ${BUDGET_CEILING}, but the guide's budget Checks lack "${NEAR_CEILING}" (D-219)`);
      }
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : unverified ? 'unverified' : 'pass', failures, unverified };
}

/** Rolled-skill gate (D-122, D-148, D-217): the rolled group's role is clear or single_target, and its figure is the largest of that role. */
function recomputeRolledSkill(endgame, plan, record, rep, fail) {
  const failures = [];
  const basis = Array.isArray(rep.basis?.rolledSkill) ? rep.basis.rolledSkill.filter(isObj) : [];
  for (const s of endgame) {
    const groups = Array.isArray(s.skills?.groups) ? s.skills.groups : [];
    const rolled = s.skills?.rolledGroup;
    const role = groups[rolled - 1]?.role;
    if (!['clear', 'single_target'].includes(role)) {
      failures.push(failure('rolledSkill', s.id, 'rolled-role', `stage ${s.id}'s rolled group ${show(rolled)} has role ${show(role)}; the rolled skill is clear or single_target, never a token role (D-122)`));
      continue;
    }
    const b = basis.find((x) => x.stage === s.id);
    if (!b) {
      fail('gate-report', `the D1 gate's basis.rolledSkill has no entry for endgame stage ${s.id} (§5.3)`);
      failures.push(failure('rolledSkill', s.id, 'rolled-not-compared', `stage ${s.id} has no figures to compare`));
      continue;
    }
    if (b.group !== rolled || b.role !== role) fail('rolled-skill', `the D1 gate names stage ${s.id}'s rolled group ${show(b.group)} (${show(b.role)}); the plan has ${rolled} (${role})`);
    const figures = Array.isArray(b.figures) ? b.figures.filter(isObj) : [];
    const sameRole = groups.map((g, i) => ({ g, n: i + 1 })).filter(({ g }) => g?.role === role).map(({ n }) => n);
    const fields = new Set();
    const values = new Map();
    for (const n of sameRole) {
      const f = figures.find((x) => x.group === n);
      if (!f) {
        fail('rolled-skill', `the D1 gate compares no figure for stage ${s.id}'s group ${n}, which has the rolled group's role ${role} (§5.3)`);
        failures.push(failure('rolledSkill', s.id, 'rolled-not-compared', `group ${n} not compared`));
        continue;
      }
      let value;
      const sk = /^g(\d+)s\d+p\d+\.(\w+)$/.exec(String(f.figure));
      const lg = /^ledger:(\w+)$/.exec(String(f.figure));
      if (sk) {
        if (Number(sk[1]) !== n) fail('rolled-skill', `the D1 gate's figure ${show(f.figure)} for stage ${s.id} is another group's, not group ${n}'s`);
        fields.add(sk[2]);
        value = record.stages[s.id]?.skillOutputs?.[String(f.figure).split('.')[0]]?.fields?.[sk[2]];
      } else if (lg) {
        value = record.ledger?.[lg[1]]?.value;
      } else {
        fail('rolled-skill', `the D1 gate's figure ${show(f.figure)} is neither a record skillOutputs field nor ledger:<id> (§5.3)`);
        continue;
      }
      if (!isNum(value)) {
        failures.push(failure('rolledSkill', s.id, 'rolled-no-figure', `stage ${s.id} group ${n}'s figure ${f.figure} isn't in the record`));
        continue;
      }
      if (!(isNum(f.value) && near(f.value, value))) fail('rolled-skill', `the D1 gate gives stage ${s.id} group ${n}'s ${f.figure} as ${show(f.value)}; the record has ${value} (compared to 2 decimals)`);
      values.set(n, value);
    }
    if (fields.size > 1) fail('rolled-skill', `the D1 gate compares stage ${s.id}'s groups by different fields ${show([...fields])}; it uses one field for every group (§5.3)`);
    const mine = values.get(rolled);
    for (const [n, v] of values) {
      if (n !== rolled && isNum(mine) && v > mine) {
        failures.push(failure('rolledSkill', s.id, 'rolled-not-largest', `stage ${s.id}'s group ${n} (${role}) has ${v}, more than the rolled group ${rolled}'s ${mine}`));
      }
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : 'pass', failures };
}

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

function main(argv) {
  const args = argv.slice(2);
  const partial = args.includes('--partial');
  const rest = args.filter((a) => a !== '--partial');
  if (rest.length !== 1 || rest[0].startsWith('--')) {
    process.stderr.write('usage: node check-run.mjs <runFolder> [--partial]\n');
    return 2;
  }
  const folder = path.resolve(rest[0]);
  const violations = checkRun(folder, { partial });
  if (violations.length === 0) {
    process.stdout.write(`check-run: ok: ${folder}${partial ? ' (partial)' : ''}\n`);
    return 0;
  }
  for (const v of violations) process.stderr.write(`check-run: [${v.rule}] ${v.message}\n`);
  process.stderr.write(`check-run: ${violations.length} violation(s) in ${folder}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}
