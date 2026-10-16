#!/usr/bin/env node
// The build-guide audit render (slice 03 §7.8, as D-355 amends it).
//
//   node .claude/skills/build-guide/scripts/render-audit.mjs <runFolder>
//
// It writes audit.md in the form of ../templates/audit-template.md from plan.json, the final compile-record.json
// and the D1 gate's last verdict file (the run log's last D1-gate entry), and keeps the lines under an existing
// audit.md's `## Known issues` (W1's rows for the accepted gate findings, and step 14's). The runner runs it after
// the D2 gate's final compile and before W1, and again before the W1 of a fix round or a revision. The run
// checker imports `loadAuditInputs`, `renderAudit` and `checksBlocks` to compare audit.md and the guide's Checks
// blocks with the render, and the price-day conversion (`priceTable`, `marketOf`, `rungBudget`, `roundDivines`,
// gates.md's "Price days, targets and ranges") to recompute the D1 gate's budget, so both use one conversion.
//
// Its choices where the template leaves one open:
//  - movement speed is the record's `outputs.EffectiveMovementSpeedMod` (PoB's "Movement Speed" in the sidebar),
//    written as a reader would, the bonus over base in whole percent: 1.251 is `+25%`;
//  - each rung's budget line (D-374) takes its total range from the D1 gate's `basis.budget.totals` and its
//    over-target slots from the gate's `over-target` findings, in the gate's order; an over-target slot's fallback
//    (the entry `<priceId>-fallback`) is converted to the rung's price day like any other price, at the gate's
//    `market` and rates (D-373), and shown in that slot's parentheses; a stage's prices are its
//    `basis.budget.slots` entries (the anoint among them, `{stage, slot: "Anoint", priceId}`) and the plan's prices
//    named `<stage>-…`, fallbacks aside; an unavailable one's `note`, or a currency with no rate, is the why;
//  - "What PoB doesn't model" reads the record: each stage's `customModsWritten` (the hand-calculated effects PoB
//    doesn't model, D-293, whose figures are estimates, D-296) and its kept PoB warnings (`pobWarnings.kept`);
//  - an Estimates value is the plan's current formula evaluated over the record with the server's evaluator, as
//    the checker's `[ledger]` does (D-365), so a ledger-only fix needs no recompile to show.
//
// Node built-ins plus the server's compiled ledger evaluator `build/plan/ledger.js` and the conversion table
// `data/economy/prices.json`. No network. Exit 0: audit.md written (one line on stdout). Exit 1: an input is
// missing or unreadable (stderr). Exit 2: usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const LEDGER_MODULE = path.join(REPO, 'build', 'plan', 'ledger.js');
const PRICES_FILE = path.join(REPO, 'data', 'economy', 'prices.json');

/** The endgame rungs, in the order the Checks blocks follow. */
const RUNGS = ['entering-maps', 'budget', 'non-budget'];
/** D-370: each rung's price day, `m` and `b` around day 7 and `n` around day 21. */
export const PRICE_DAY = { 'entering-maps': 7, budget: 7, 'non-budget': 21 };
/** D-370: `m`'s target in all, in divines (D-281's number); `b` and `n` read each rare's from its `query.target`. */
export const M_TARGET = 5;
/** D-374: what each rung's budget line measures its total against. */
const TARGET_TEXT = { 'entering-maps': 'against a 5-divine target', budget: 'aiming at about 5 a slot', 'non-budget': 'against the 100–200 target' };
const SOURCE_KINDS = ['pob-computed', 'pob-data', 'external', 'judgment', 'external-unavailable'];
const OTHER_TYPES = ['Fire', 'Cold', 'Lightning', 'Chaos'];
/** The six H2s of audit.md, in order (the template's). */
export const AUDIT_H2 = ['Estimates', 'Stage detail', 'Checks', "What PoB doesn't model", 'Inputs by confidence', 'Known issues'];

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const list = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
/** A number as the plan or the record holds it, or `—`. */
const num = (v) => (isNum(v) ? String(v) : '—');
const fixed2 = (v) => (isNum(v) ? v.toFixed(2) : '—');
/** A table cell: one line, its pipes escaped. */
const cell = (v) => String(v ?? '—').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');
/** A text ending in exactly one full stop. */
const sentence = (v) => `${String(v ?? '').trim().replace(/\.+$/, '')}.`;
const bare = (v) => String(v ?? '').trim().replace(/\.+$/, '');
const stagesWord = (ids) => (ids.length === 1 ? `stage ${ids[0]}` : `stages ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`);

// ---------------------------------------------------------------------------------------------------
// Price days and ranges (D-370, D-373; gates.md "Price days, targets and ranges", steps 1 to 7)
// ---------------------------------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
let priceTableCache = null;

/**
 * D-373's conversion from `data/economy/prices.json`: the threshold, each row's factors to day 7 and day 21, the
 * late divisor, the first and late league days, and the league table. Throws an Error naming what is missing.
 */
export function priceTable() {
  if (priceTableCache !== null) return priceTableCache;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
  } catch (e) {
    throw new Error(`data/economy/prices.json is unreadable: ${e.message}`);
  }
  const facts = isObj(data?.facts) ? data.facts : {};
  const value = (id, ok) => {
    const v = facts[id]?.value;
    if (!ok(v)) throw new Error(`data/economy/prices.json has no usable fact ${id}`);
    return v;
  };
  const range = (v) => isObj(v) && isNum(v.min) && isNum(v.max);
  const row = (name) => ({ 7: value(`conversion.${name}.to-day-7`, range), 21: value(`conversion.${name}.to-day-21`, range) });
  priceTableCache = {
    threshold: value('conversion.threshold', isNum),
    rows: { 'under-10': row('under-10'), '10-or-more': row('10-or-more') },
    lateDivisor: value('conversion.late-divisor', range),
    firstDay: value('conversion.first-day', isNum),
    lateDay: value('conversion.late-day', isNum),
    leagues: Object.entries(facts).filter(([id]) => id.startsWith('league.')).map(([, f]) => f?.value).filter((l) => isObj(l) && typeof l.name === 'string' && ISO_DATE.test(String(l.start))),
  };
  return priceTableCache;
}

/** Step 6: an end of a range, 10 divines or more to a whole divine, under 10 to one decimal. */
export const roundDivines = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

/** The recorded rates by currency (`basis.budget.rates`); a divine counts 1. */
const ratesOf = (budget) => new Map(list(budget?.rates).filter((r) => isNum(r.divines)).map((r) => [String(r.currency).toLowerCase(), r.divines]));

/** Step 2: an `ok` entry's price in divines, unrounded; null when it isn't `ok` or its currency has no rate. */
function divinesOf(price, rates) {
  if (!isObj(price) || price.status !== 'ok' || !isNum(price.amount) || typeof price.currency !== 'string') return null;
  const currency = price.currency.toLowerCase();
  const rate = rates.has(currency) ? rates.get(currency) : /^divine/.test(currency) ? 1 : undefined;
  return isNum(rate) ? price.amount * rate : null;
}

/**
 * Step 1: the market the prices were seen in, `{league, day, late}`. `league` is the plan's (null offline); the seen
 * date is the latest date of the `ok` entries `budget.slots` names; `day` is the whole days from the league's start
 * to it (null when the league isn't in the table or no entry is `ok`); `late` when the league ended before it or
 * the day is past `conversion.late-day`.
 */
export function marketOf(plan, budget, table) {
  const league = typeof plan?.league === 'string' ? plan.league : null;
  const prices = new Map(list(plan?.prices).map((p) => [p.id, p]));
  const dates = list(budget?.slots).map((x) => prices.get(x.priceId)).filter((p) => p?.status === 'ok' && ISO_DATE.test(String(p.date))).map((p) => p.date).sort();
  const seen = dates.length > 0 ? dates[dates.length - 1] : null;
  const fact = league === null ? undefined : table.leagues.find((l) => l.name === league);
  const day = fact && seen !== null ? Math.round((Date.parse(seen) - Date.parse(fact.start)) / DAY_MS) : null;
  const late = (seen !== null && typeof fact?.end === 'string' && fact.end < seen) || (day !== null && day > table.lateDay);
  return { league, day, late };
}

/**
 * Steps 3 and 4: a price of `p` divines at the price day `day` (7 or 21): its row's factors (late: the low over
 * the divisor's max and the high over its min; a known day before `conversion.first-day`: 1), and its range
 * `{low, high, mid}`, unrounded.
 */
export function rangeAt(p, day, market, table) {
  const f = table.rows[p < table.threshold ? 'under-10' : '10-or-more'][day];
  const [lo, hi] = market?.late === true ? [f.min / table.lateDivisor.max, f.max / table.lateDivisor.min]
    : !isNum(market?.day) || market.day >= table.firstDay ? [f.min, f.max] : [1, 1];
  return { low: p * lo, high: p * hi, mid: (p * lo + p * hi) / 2 };
}

/**
 * Steps 5 and 7 for one endgame stage: `{day, total, overTarget, ranges}`. `total` is `{low, high, mid}` summed over
 * the entries `budget.slots` names for the stage, a shared entry once for each slot (a fallback is in no slot, so
 * it counts in none), or null when any of them is missing, unavailable or in a currency without a rate. `overTarget`
 * lists, on `b` and `n`, each entry with a `query.target` whose midpoint is above `query.target.divines`, named by
 * the first slot that maps to it, and on `m` the total when its midpoint is above 5. `ranges` maps each priceId the
 * stage's slots name to its range, or null. Every value is unrounded.
 */
export function rungBudget(stage, plan, budget, market, table) {
  const day = PRICE_DAY[stage.variant];
  const prices = new Map(list(plan?.prices).map((p) => [p.id, p]));
  const rates = ratesOf(budget);
  const maps = list(budget?.slots).filter((x) => x.stage === stage.id);
  const ranges = new Map();
  let [low, high, known] = [0, 0, true];
  for (const x of maps) {
    if (!ranges.has(x.priceId)) {
      const p = divinesOf(prices.get(x.priceId), rates);
      ranges.set(x.priceId, p === null ? null : rangeAt(p, day, market, table));
    }
    const r = ranges.get(x.priceId);
    if (r === null) known = false;
    else [low, high] = [low + r.low, high + r.high];
  }
  const total = known ? { low, high, mid: (low + high) / 2 } : null;
  const overTarget = [];
  if (stage.variant === 'entering-maps') {
    if (total !== null && total.mid > M_TARGET) overTarget.push({ stage: stage.id, low: total.low, high: total.high, mid: total.mid, target: M_TARGET });
  } else {
    for (const [priceId, r] of ranges) {
      const target = prices.get(priceId)?.query?.target?.divines;
      if (r === null || !isNum(target) || !(r.mid > target)) continue;
      const first = maps.find((x) => x.priceId === priceId);
      overTarget.push({ stage: stage.id, ...(first.jewel !== undefined ? { jewel: first.jewel } : { slot: first.slot }), priceId, low: r.low, high: r.high, mid: r.mid, target });
    }
  }
  return { day, total, overTarget, ranges };
}

// ---------------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------------

/**
 * Reads what the render needs from a run folder: the plan, the final record, the D1 gate's last verdict file, the
 * card's title, the run's mode, the current audit.md (for its Known issues), each ledger entry's value and the
 * price-day conversion (`priceTable`).
 * Throws an Error naming what is missing.
 */
export async function loadAuditInputs(runFolder) {
  const file = (rel) => path.join(runFolder, ...rel.split('/'));
  const json = (rel) => {
    let text;
    try {
      text = fs.readFileSync(file(rel), 'utf8');
    } catch {
      throw new Error(`${rel} is missing`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`${rel} isn't valid JSON: ${e.message}`);
    }
  };
  const plan = json('plan.json');
  const record = json('compile-record.json');
  const log = json('run-log.json');
  const entry = list(log.stages).filter((s) => s.stage === 'D1-gate' && s.outcome !== 'missing').pop();
  if (!entry) throw new Error('run-log.json has no D1-gate entry; the render reads the D1 gate\'s last verdict file');
  const gateFile = `reports/gates/D1-gate-${entry.concept}-a${entry.attempt}.json`;
  const gate = json(gateFile);
  let title = String(entry.concept);
  try {
    title = /^# Card [^:\n]+:\s*(.+?)\s*$/m.exec(fs.readFileSync(file(`cards/${entry.concept}.md`), 'utf8'))?.[1] ?? title;
  } catch {
    // no card file: the card id stands in for its title
  }
  const audit = fs.existsSync(file('audit.md')) ? fs.readFileSync(file('audit.md'), 'utf8') : null;
  if (!fs.existsSync(LEDGER_MODULE)) throw new Error(`the server's ledger evaluator ${path.relative(REPO, LEDGER_MODULE)} is missing; build the server (pnpm build)`);
  const ledgerModule = await import(pathToFileURL(LEDGER_MODULE).href);
  const prices = priceTable();
  return { plan, record, gate, gateFile, title, offline: log.mode === 'offline', audit, ledger: ledgerValues(ledgerModule, plan, record), prices };
}

/** Each ledger entry's value: its current formula over the record's stages (D-365), null when it errs. */
export function ledgerValues(ledgerModule, plan, record) {
  const stages = isObj(record?.stages) ? record.stages : {};
  const numbers = Object.fromEntries(Object.entries(stages).filter(([, s]) => isObj(s)).map(([id, s]) => [id, { outputs: isObj(s.outputs) ? s.outputs : {}, skillOutputs: isObj(s.skillOutputs) ? s.skillOutputs : {} }]));
  const entries = list(plan?.ledger).filter((e) => typeof e.id === 'string' && typeof e.formula === 'string').map((e) => ({ id: e.id, formula: e.formula, inputs: list(e.inputs) }));
  const results = ledgerModule.evaluateLedger(entries, { stageIds: list(plan?.stages).map((s) => s.id), stages: numbers });
  return Object.fromEntries(entries.map((e) => [e.id, results[e.id]?.value ?? null]));
}

// ---------------------------------------------------------------------------------------------------
// The render
// ---------------------------------------------------------------------------------------------------

/** audit.md's text, in the template's form. */
export function renderAudit(inp) {
  const roll = isObj(inp.plan?.roll) ? inp.plan.roll : {};
  const out = [`# Audit: ${roll.ascendancy ?? '—'} / ${roll.skill ?? '—'}, ${inp.title}`, ''];
  out.push('## Estimates', '', ...estimates(inp), '');
  out.push('## Stage detail', '', ...stageDetail(inp), '');
  out.push('## Checks', '');
  for (const b of checksBlocks(inp)) out.push(`### ${b.loadoutName}`, '', ...b.lines, '');
  out.push("## What PoB doesn't model", '', ...modelGaps(inp), '');
  out.push('## Inputs by confidence', '', ...byConfidence(inp), '');
  out.push('## Known issues', '', ...knownIssues(inp.audit));
  return `${out.join('\n')}\n`;
}

/** The lines under a text's `## Known issues`, to the next H1 or H2, or `None.` when it has none. */
export function knownIssues(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s+Known issues\s*$/.test(l));
  if (at < 0) return ['None.'];
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
  return body === '' ? ['None.'] : body.split('\n');
}

function estimates({ plan, record, ledger }) {
  const table = [];
  const entries = list(plan.ledger);
  if (entries.length > 0) {
    table.push('| Entry | Claim | Value | Formula |', '|---|---|---|---|');
    for (const e of entries) table.push(`| \`${e.id}\` | ${cell(e.claim)} | ${fixed2(ledger[e.id])} | ${cell(e.formula)} |`);
  }
  const stages = list(plan.stages);
  const counts = new Map();
  for (const s of stages) {
    list(s.skills?.groups).forEach((g, k) => {
      if (!Number.isInteger(g.count) || g.count <= 1) return;
      const label = g.label ?? list(g.gems)[0]?.name ?? `group ${k + 1}`;
      const key = JSON.stringify([label, g.count, g.countReason ?? '']);
      if (!counts.has(key)) counts.set(key, { label, count: g.count, reason: g.countReason, stages: [] });
      counts.get(key).stages.push(s.id);
    });
  }
  const bullets = [...counts.values()].map((c) => `- **Count:** ${c.label} on ${stagesWord(c.stages)} counts ${c.count} copies: ${sentence(c.reason ?? 'no reason given')}`);
  const marked = stages.filter((s) => record.stages?.[s.id]?.computedWithCustomMods === true).map((s) => s.id);
  for (const s of stages) {
    for (const m of list(s.config?.customMods)) {
      const figures = marked.length > 0 ? ` The figures of ${stagesWord(marked)} are estimates (D-296).` : '';
      bullets.push(`- **Custom modifier:** \`${m.text}\` on stage ${s.id}: ${sentence(m.reason ?? 'no reason given')}${figures}`);
    }
  }
  const out = [...table, ...(table.length > 0 && bullets.length > 0 ? [''] : []), ...bullets];
  return out.length > 0 ? out : ['None.'];
}

/** The named source's Count-scaled figure (D-294): its counted breakdown entry's TotalDPS, else the main skill's. */
function headlineDps(stage, rec) {
  const m = isObj(stage.skills?.main) ? stage.skills.main : {};
  const key = `g${m.group}s${m.activeSkill}p${m.statSet ?? 1}`;
  return rec.countedSkillOutputs?.[key]?.fields?.TotalDPS ?? rec.countedOutputs?.fields?.TotalDPS;
}

function stageDetail({ plan, record }) {
  const out = [
    '| Loadout | Level | Life | Named source DPS | Fire / cold / lightning / chaos | Max hit, physical / least of the others | Reference hit, physical / largest of the others | Effective HP |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const s of list(plan.stages)) {
    const rec = isObj(record.stages?.[s.id]) ? record.stages[s.id] : {};
    const o = isObj(rec.outputs) ? rec.outputs : {};
    const endgame = typeof s.variant === 'string';
    const others = OTHER_TYPES.map((t) => o[`${t}MaximumHitTaken`]).filter(isNum);
    const cw = isObj(rec.configWritten) ? rec.configWritten : {};
    const hits = OTHER_TYPES.map((t) => cw[`enemy${t}Damage`]).filter(isNum);
    const reference = endgame ? `${num(cw.enemyPhysicalDamage)} / ${hits.length > 0 ? num(Math.max(...hits)) : '—'}` : '—';
    out.push(`| ${cell(rec.loadoutName ?? s.loadoutName)} | ${num(rec.level ?? s.level)} | ${num(o.Life)} | ${num(endgame ? rec.measures?.dps : headlineDps(s, rec))} | ${['Fire', 'Cold', 'Lightning', 'Chaos'].map((t) => num(o[`${t}Resist`])).join('/')}% | ${num(o.PhysicalMaximumHitTaken)} / ${others.length > 0 ? num(Math.min(...others)) : '—'} | ${reference} | ${num(endgame ? rec.measures?.ehp : o.TotalEHP)} |`);
  }
  return out;
}

/**
 * Each endgame rung's Checks block, in rung order: `{variant, stage, loadoutName, lines}`, `lines` every line
 * under its H3 (the block W1 copies verbatim into the guide's Checks, D-355).
 */
export function checksBlocks({ plan, record, gate, prices }) {
  const stages = list(plan.stages);
  const blocks = [];
  for (const variant of RUNGS) {
    const s = stages.find((x) => x.variant === variant);
    if (!s) continue;
    const rec = isObj(record.stages?.[s.id]) ? record.stages[s.id] : {};
    const lines = [];
    if (isObj(s.chaosResistException)) lines.push(`- Chaos resistance stays at ${num(rec.outputs?.ChaosResist)}% because ${sentence(s.chaosResistException.reason)}`);
    lines.push(...budgetLines(s, plan, gate, prices));
    if (variant !== 'entering-maps') lines.push(arbiterLine(rec.measures?.arbiter));
    lines.push(clearLine(rec));
    blocks.push({ variant, stage: s.id, loadoutName: rec.loadoutName ?? s.loadoutName, lines });
  }
  return blocks;
}

/**
 * Why a rung's prices are unavailable: each unavailable price's note, or a currency without a rate; '' when none.
 * A fallback (`<id>-fallback`) counts in no total (D-371), so it is no reason.
 */
function unavailableWhy(s, plan, budget, known) {
  const prices = new Map(list(plan.prices).map((p) => [p.id, p]));
  const ids = new Set(list(budget.slots).filter((x) => x.stage === s.id).map((x) => x.priceId));
  for (const p of list(plan.prices)) if (String(p.id).startsWith(`${s.id}-`) && !String(p.id).endsWith('-fallback')) ids.add(p.id);
  const rates = new Set(list(budget.rates).map((r) => String(r.currency).toLowerCase()));
  const why = [];
  for (const id of ids) {
    const p = prices.get(id);
    if (!p) continue;
    if (p.status === 'unavailable') why.push(bare(p.note ?? 'unavailable'));
    else if (typeof p.currency === 'string' && !/^divine/i.test(p.currency) && !rates.has(p.currency.toLowerCase())) why.push(`no rate for ${p.currency}`);
  }
  if (why.length === 0 && !known) why.push("the D1 gate's basis gives no total");
  return [...new Set(why)].join('; ');
}

/** A range as the budget lines write it: `<low>–<high>`, or `<low>` alone when the two are equal. */
const rangeText = (low, high) => (low === high ? `${low}` : `${low}–${high}`);

/**
 * An endgame stage's budget lines (D-374), the first line of its Checks block after the chaos exception: its total
 * range around its price day against its target, from the D1 gate's `basis.budget.totals`, then on `b` and `n`
 * the over-target slots from the gate's `over-target` findings (each slot's fallback converted like any other
 * price, D-373), kept when the total is unknown; and D-164's line when a price is unavailable. Exported for
 * run-log.mjs's final display.
 */
export function budgetLines(s, plan, gate, prices) {
  const budget = isObj(gate?.basis?.budget) ? gate.basis.budget : {};
  const row = list(budget.totals).find((t) => t.stage === s.id);
  const known = isNum(row?.low) && isNum(row?.high);
  const shown = known ? `about ${rangeText(row.low, row.high)} divines around day ${PRICE_DAY[s.variant]}` : 'unknown';
  const over = s.variant === 'entering-maps' ? [] : list(gate?.findings).filter((f) => f.part === 'budget' && f.code === 'over-target' && f.stage === s.id);
  const slots = over.map((f) => `${f.jewel !== undefined ? `Jewel ${f.jewel}` : f.slot} (about ${rangeText(f.low, f.high)}${fallbackText(s, f, plan, budget, prices)})`);
  const lines = [`- Budget: ${shown}, ${TARGET_TEXT[s.variant]}.${slots.length > 0 ? ` Over target: ${slots.join(', ')}.` : ''}`];
  const why = unavailableWhy(s, plan, budget, known);
  if (why !== '') lines.push(`  Prices are unavailable (${why}), so this rung's total isn't known.`);
  return lines;
}

/**
 * An over-target slot's fallback, `; fallback about <low>–<high>`: the entry `<its priceId>-fallback` (D-371)
 * converted to the rung's price day at the gate's market and rates, rounded as the totals are; `; fallback price
 * unknown` when it is unavailable or has no rate; '' when the slot has none.
 */
function fallbackText(s, f, plan, budget, prices) {
  const map = list(budget.slots).find((x) => x.stage === s.id && (f.jewel !== undefined ? x.jewel === f.jewel : x.slot === f.slot));
  const fallback = map ? list(plan.prices).find((p) => p.id === `${map.priceId}-fallback`) : undefined;
  if (!fallback) return '';
  let table = isObj(prices) ? prices : null;
  if (table === null) {
    try {
      table = priceTable();
    } catch {
      table = null;
    }
  }
  const p = divinesOf(fallback, ratesOf(budget));
  if (p === null || table === null) return '; fallback price unknown';
  const market = isObj(budget.market) ? budget.market : marketOf(plan, budget, table);
  const r = rangeAt(p, PRICE_DAY[s.variant], market, table);
  return `; fallback about ${rangeText(roundDivines(r.low), roundDivines(r.high))}`;
}

/** The Arbiter line on `b` and `n`, from the record's `measures.arbiter` (D-353). */
function arbiterLine(arbiter) {
  const worst = arbiter?.worst;
  if (!isObj(arbiter) || !['survives', 'one-shot'].includes(arbiter.verdict) || !isObj(worst) || !isNum(worst.ratio)) return '- The Arbiter of Divinity: not measured.';
  const hit = `${String(worst.type).split('-').join(' and ')} hit`;
  return arbiter.verdict === 'survives'
    ? `- The Arbiter of Divinity: survives its hits; its worst, ${hit}, is ${worst.ratio.toFixed(2)} of your max hit.`
    : `- The Arbiter of Divinity: one-shot by its ${hit}, at ${worst.ratio.toFixed(2)} of your max hit.`;
}

function clearLine(rec) {
  const c = rec.measures?.clearSpeed;
  const speed = typeof c?.speed === 'string' ? c.speed : 'not measured';
  const from = typeof c?.skill === 'string' ? `a rough estimate from ${c.skill}'s area` : 'a rough estimate; PoB measured no clear skill';
  const move = rec.outputs?.EffectiveMovementSpeedMod;
  const pct = isNum(move) ? Math.round((move - 1) * 100) : null;
  return `- Clear speed: ${speed}, ${from}. Movement speed: ${pct === null ? 'not measured' : `${pct < 0 ? '' : '+'}${pct}%`}.`;
}

function modelGaps({ plan, record }) {
  const out = [];
  for (const s of list(plan.stages)) {
    const rec = record.stages?.[s.id];
    if (!isObj(rec)) continue;
    const mods = (Array.isArray(rec.customModsWritten) ? rec.customModsWritten : []).filter((m) => typeof m === 'string');
    if (mods.length > 0) {
      const figures = rec.computedWithCustomMods === true ? ', so its figures are estimates (D-296)' : '';
      out.push(`- Stage ${s.id}: ${mods.map((m) => `\`${m}\``).join(', ')}, hand-calculated as custom modifiers for effects PoB doesn't model${figures}.`);
    }
    for (const w of Array.isArray(rec.pobWarnings?.kept) ? rec.pobWarnings.kept : []) out.push(`- Stage ${s.id}: PoB warns "${bare(w)}".`);
  }
  return out.length > 0 ? out : ['None.'];
}

/** Every source tag in the plan, in order, with its path. */
function tagsOf(v, at = [], out = []) {
  if (Array.isArray(v)) v.forEach((x, i) => tagsOf(x, [...at, i], out));
  else if (isObj(v)) {
    if (SOURCE_KINDS.includes(v.kind) && typeof v.ref === 'string') out.push({ at, tag: v });
    else for (const [k, x] of Object.entries(v)) tagsOf(x, [...at, k], out);
  }
  return out;
}

/** What rests on a tag, by where it sits in the plan. */
function describeTag(plan, at, tag) {
  const pathText = at.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('').replace(/^\./, '');
  const stage = at[0] === 'stages' ? list(plan.stages)[at[1]] : undefined;
  if (stage && at[2] === 'claims' && at[4] === 'source') {
    const c = list(stage.claims)[at[3]];
    return `\`${c?.id}\` on stage ${stage.id}: ${bare(c?.text)}`;
  }
  if (at[0] === 'ledger' && at[2] === 'inputs') {
    const e = list(plan.ledger)[at[1]];
    const input = list(e?.inputs)[at[3]];
    return `input \`${input?.name}\` (${num(input?.value)}) of \`${e?.id}\`: ${bare(e?.claim)}`;
  }
  if (stage && at[2] === 'chaosResistException') return `stage ${stage.id}'s chaos resistance exception: ${bare(stage.chaosResistException?.reason)}`;
  if (stage && at[2] === 'config' && at[3] === 'scenario') {
    const e = list(stage.config?.scenario)[at[4]];
    return `stage ${stage.id}'s config \`${e?.option}\` = ${JSON.stringify(e?.value)}`;
  }
  return `\`${pathText}\`: ${bare(tag.ref)}`;
}

function byConfidence({ plan, offline }) {
  const tags = tagsOf(plan);
  const level = (c) => tags.filter((t) => t.tag.confidence === c).map((t) => describeTag(plan, t.at, t.tag));
  const join = (items) => (items.length > 0 ? `${items.join('; ')}.` : 'none.');
  const out = [`- **M:** ${join(level('M'))}`, `- **L:** ${join(level('L'))}`];
  if (offline) {
    const external = [];
    list(plan.stages).forEach((s) => list(s.claims).forEach((c) => {
      if (isObj(c.source) && c.source.kind === 'external-unavailable') external.push(`\`${c.id}\` on stage ${s.id}: ${bare(c.text)}`);
    }));
    out.push(`- **Needs an external source** (external source unavailable in this offline run): ${join(external)}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

async function main(argv) {
  const args = argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('--')) {
    process.stderr.write('usage: node render-audit.mjs <runFolder>\n');
    return 2;
  }
  const folder = path.resolve(args[0]);
  let inputs;
  try {
    inputs = await loadAuditInputs(folder);
  } catch (e) {
    process.stderr.write(`render-audit: ${e.message}\n`);
    return 1;
  }
  fs.writeFileSync(path.join(folder, 'audit.md'), renderAudit(inputs));
  process.stdout.write(`render-audit: wrote audit.md from plan.json, compile-record.json and ${inputs.gateFile}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv);
}
