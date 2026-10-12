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
// blocks with the render.
//
// Its choices where the template leaves one open:
//  - movement speed is the record's `outputs.EffectiveMovementSpeedMod` (PoB's "Movement Speed" in the sidebar),
//    written `<n>× base`;
//  - the budget totals and the reference come from the D1 gate's `basis.budget` (`totals`, `nonBudget`); a stage's
//    prices are its `basis.budget.slots` entries (the anoint among them, `{stage, slot: "Anoint", priceId}`) and
//    the plan's prices named `<stage>-…`; an unavailable one's `note`, or a currency with no rate, is the why;
//  - "What PoB doesn't model" reads the record: each stage's `customModsWritten` (the hand-calculated effects PoB
//    doesn't model, D-293, whose figures are estimates, D-296) and its kept PoB warnings (`pobWarnings.kept`);
//  - an Estimates value is the plan's current formula evaluated over the record with the server's evaluator, as
//    the checker's `[ledger]` does (D-365), so a ledger-only fix needs no recompile to show.
//
// Node built-ins plus the server's compiled ledger evaluator `build/plan/ledger.js`. No network. Exit 0: audit.md
// written (one line on stdout). Exit 1: an input is missing or unreadable (stderr). Exit 2: usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const LEDGER_MODULE = path.join(REPO, 'build', 'plan', 'ledger.js');

/** The endgame rungs, in the order the Checks blocks follow. */
const RUNGS = ['entering-maps', 'budget', 'non-budget'];
const BUDGETS = { 'entering-maps': { ceiling: 5, tolerance: 5.5 }, budget: { ceiling: 20, tolerance: 22 } };
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
// Inputs
// ---------------------------------------------------------------------------------------------------

/**
 * Reads what the render needs from a run folder: the plan, the final record, the D1 gate's last verdict file, the
 * card's title, the run's mode, the current audit.md (for its Known issues) and each ledger entry's value.
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
  return { plan, record, gate, gateFile, title, offline: log.mode === 'offline', audit, ledger: ledgerValues(ledgerModule, plan, record) };
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
export function checksBlocks({ plan, record, gate }) {
  const stages = list(plan.stages);
  const blocks = [];
  for (const variant of RUNGS) {
    const s = stages.find((x) => x.variant === variant);
    if (!s) continue;
    const rec = isObj(record.stages?.[s.id]) ? record.stages[s.id] : {};
    const lines = [];
    if (isObj(s.chaosResistException)) lines.push(`- Chaos resistance stays at ${num(rec.outputs?.ChaosResist)}% because ${sentence(s.chaosResistException.reason)}`);
    lines.push(...budgetLines(variant, s, plan, isObj(gate?.basis?.budget) ? gate.basis.budget : {}));
    if (variant !== 'entering-maps') lines.push(arbiterLine(rec.measures?.arbiter));
    lines.push(clearLine(rec));
    blocks.push({ variant, stage: s.id, loadoutName: rec.loadoutName ?? s.loadoutName, lines });
  }
  return blocks;
}

/** Why a rung's prices are unavailable: each unavailable price's note, or a currency without a rate; '' when none. */
function unavailableWhy(s, plan, budget, total) {
  const prices = new Map(list(plan.prices).map((p) => [p.id, p]));
  const ids = new Set(list(budget.slots).filter((x) => x.stage === s.id).map((x) => x.priceId));
  for (const p of list(plan.prices)) if (String(p.id).startsWith(`${s.id}-`)) ids.add(p.id);
  const rates = new Set(list(budget.rates).map((r) => String(r.currency).toLowerCase()));
  const why = [];
  for (const id of ids) {
    const p = prices.get(id);
    if (!p) continue;
    if (p.status === 'unavailable') why.push(bare(p.note ?? 'unavailable'));
    else if (typeof p.currency === 'string' && !/^divine/i.test(p.currency) && !rates.has(p.currency.toLowerCase())) why.push(`no rate for ${p.currency}`);
  }
  if (why.length === 0 && total === null) why.push("the D1 gate's basis gives no total");
  return [...new Set(why)].join('; ');
}

function budgetLines(variant, s, plan, budget) {
  const nonBudget = variant === 'non-budget';
  const row = list(nonBudget ? budget.nonBudget : budget.totals).find((t) => t.stage === s.id);
  const total = isNum(row?.divines) ? row.divines : null;
  const shown = total === null ? 'unknown' : `${total} divines`;
  const why = unavailableWhy(s, plan, budget, total);
  if (nonBudget) {
    const lines = [`- Total: ${shown} against the ~${isNum(row?.reference) ? row.reference : 200}-divine reference, which is no cap.`];
    if (why !== '') lines.push(`  Prices are unavailable (${why}), so this total isn't known.`);
    return lines;
  }
  const { ceiling, tolerance } = BUDGETS[variant];
  const lines = [variant === 'budget' ? `- Budget: ${shown} against 20.` : `- Budget: ${shown} against the 5-divine ceiling.`];
  const rounded = total === null ? null : Math.round(total * 100) / 100;
  if (rounded !== null && rounded > ceiling && rounded <= tolerance) lines.push(`  ${total} divines is near the ceiling: over ${ceiling}, within the ${tolerance}-divine tolerance.`);
  if (why !== '') {
    lines.push(variant === 'budget'
      ? `  Prices are unavailable (${why}), so this variant can't be claimed to be under 20 divines.`
      : `  Prices are unavailable (${why}), so this rung can't be claimed to fit 5 divines.`);
  }
  return lines;
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
  return `- Clear speed: ${speed}, ${from}. Movement speed: ${isNum(move) ? `${move}× base` : 'not measured'}.`;
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
