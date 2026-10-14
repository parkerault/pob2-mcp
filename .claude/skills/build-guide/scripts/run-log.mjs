#!/usr/bin/env node
// The build-guide run log's writer (D-356): the runner writes run-log.json only through it, never with Write.
//
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> init '{"slug", "brief", "mode", "testConfig"[, "status"]}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> stage '{"stage", "concept"?, "attempt", "outcome", …}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> checkpoint '{"checkpoint", "visit", "answer", "answeredBy", "rule"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> escalation '{"stage", "concept", "verdict", "choice", "guidance"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> set '{"status"?, "roll"?, "outputs"?, "faults"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display <brainstorm|verification|design|final|escalation>
//
// `-` in place of the JSON reads the entry from stdin, as a quoted heredoc gives it, so a text with an apostrophe
// (a brief's notes, a `revise:` text, a retry's guidance, a final-gate note) needs no shell quoting:
//
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> stage - <<'JSON'
//   {"stage", …}
//   JSON
//
// `init` writes the first log (schema 3, `runFolder` the folder given, no roll, empty lists) and never overwrites
// one; `stage`, `checkpoint` and `escalation` append one entry to `stages[]`, `checkpoints[]` or `escalations[]`;
// `set` replaces those top-level fields. Each entry has exactly the fields of ../references/run-log.md's entry
// form, and a wrong one is refused with nothing written. The run checker checks the whole log and its flow.
//
// `display <gate>` (D-367) prints that gate visit's display on stdout, built from the run folder's files, and
// records the visit in `displays[]` as `{checkpoint, visit}`, the visit one more than the gate's checkpoints[]
// entries; printing it again records nothing new. A gate's `checkpoint` entry is refused until its visit's display
// is recorded. The final gate's display runs the run checker and carries each endgame rung's final figures (D-369).
// Exit 0: written, or the display printed (stdout). Exit 1: refused (stderr). Exit 2: usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CARD = /^r[1-9]\d*-[a-c]-[1-9]\d*$/;
const IDS = '(?:r[1-9]\\d*-[a-c]-[1-9]\\d*)(?:,r[1-9]\\d*-[a-c]-[1-9]\\d*){0,2}';
const TRADE_KINDS = ['no_session', 'session_rejected', 'too_complex', 'invalid_query', 'rate_limited', 'locked_out', 'would_wait', 'auth', 'http', 'network', 'timeout', 'disabled'];
/** Each stage and its outcomes (run-log.md); every step may also be `missing`. */
const OUTCOMES = {
  R1a: ['done'],
  'R1a-assemble': ['done'],
  R1b: ['pass', 'fail'],
  'R1b-assemble': ['done'],
  'D1-build': ['done', 'infeasible'],
  'D1-finish': ['done', 'claims-edited'],
  'D1-gate': ['pass', 'fail', 'infeasible', 'escalated'],
  D2: ['done', 'claims-edited'],
  'D2-gate': ['pass', 'fail', 'escalated'],
  W1: ['done'],
  V4: ['pass', 'fail'],
  'V4-recheck': ['pass', 'fail'],
};
const NO_CONCEPT = ['R1a', 'R1a-assemble', 'R1b-assemble'];
const PRICING = ['R1b', 'D1-finish', 'D1-gate', 'D2'];
/** Each gate's or question's answers (run-log.md, D-362). */
const ANSWERS = {
  brainstorm: new RegExp(`^(?:pick:${IDS}|more|stop)$`),
  verification: new RegExp(`^(?:pick:${CARD.source.slice(1, -1)}|verify:${IDS}|more|stop)$`),
  design: /^(?:accept|revise:.+|verification|stop)$/s,
  final: /^.+$/s,
  'unsaved-build': /^(?:proceed|stop)$/,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
const STATUSES = ['running', 'completed', 'not-accepted', 'stopped', 'escalated'];
/** Each kind's fields, in the order run-log.md writes them. */
const FIELDS = {
  stage: ['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes', 'probes', 'shortReason'],
  checkpoint: ['checkpoint', 'visit', 'answer', 'answeredBy', 'rule'],
  escalation: ['stage', 'concept', 'verdict', 'choice', 'guidance'],
  set: ['status', 'roll', 'outputs', 'faults'],
  init: ['slug', 'brief', 'mode', 'testConfig', 'status'],
};
const OUTPUTS = ['plan', 'record', 'dossier', 'guide', 'pobFile'];
/** The gates and the question whose visits print a display first (D-265, D-367); the unsaved-build question has none. */
export const DISPLAYED = ['brainstorm', 'verification', 'design', 'final', 'escalation'];
/** The endgame rungs, in ladder order (the plan's `variant`). */
const RUNGS = ['entering-maps', 'budget', 'non-budget'];

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v, min) => Number.isInteger(v) && v >= min;
const text = (v) => typeof v === 'string' && v.trim() !== '';
const show = (v) => JSON.stringify(v);

/** The problems with an entry of a kind: its fields, as run-log.md's entry form gives them. */
export function entryProblems(kind, e) {
  if (!isObj(e)) return ['the entry is a JSON object'];
  const allowed = FIELDS[kind] ?? [];
  const bad = Object.keys(e).filter((k) => !allowed.includes(k)).map((k) => `"${k}" isn't a field of a ${kind} entry (${allowed.join(', ')})`);
  if (kind === 'stage') {
    const outcomes = OUTCOMES[e.stage];
    if (!outcomes) return [...bad, `stage ${show(e.stage)} isn't one of ${Object.keys(OUTCOMES).join(', ')}`];
    if (NO_CONCEPT.includes(e.stage) ? e.concept !== undefined : !CARD.test(String(e.concept))) bad.push(NO_CONCEPT.includes(e.stage) ? `a ${e.stage} entry has no concept` : `concept ${show(e.concept)} isn't a card id r<round>-<letter>-<n>`);
    if (!isInt(e.attempt, 1)) bad.push(`attempt ${show(e.attempt)} isn't a whole number from 1`);
    if (![...outcomes, 'missing'].includes(e.outcome)) bad.push(`a ${e.stage} entry's outcome is ${[...outcomes, 'missing'].join(', ')}, not ${show(e.outcome)}`);
    if (e.priceOutcomes !== undefined) {
      if (!PRICING.includes(e.stage)) bad.push(`priceOutcomes is only on ${PRICING.join(', ')}`);
      else if (!isObj(e.priceOutcomes) || Object.entries(e.priceOutcomes).some(([k, v]) => !['ok', 'error', ...TRADE_KINDS].includes(k) || !isInt(v, 0))) bad.push('priceOutcomes counts calls by outcome: ok, error or a [trade:<kind>] kind, each a whole number');
    }
    if (e.stage === 'R1b' ? !isInt(e.probes, 0) : e.probes !== undefined) bad.push(e.stage === 'R1b' ? 'an R1b entry has probes, the probe variants it ran (0 when none)' : 'probes is only on R1b');
    if (e.stage === 'R1a-assemble' ? e.shortReason !== undefined && !text(e.shortReason) : e.shortReason !== undefined) bad.push('shortReason is only on R1a-assemble, a non-empty text');
  } else if (kind === 'checkpoint') {
    const form = ANSWERS[e.checkpoint];
    if (!form) return [...bad, `checkpoint ${show(e.checkpoint)} isn't one of ${Object.keys(ANSWERS).join(', ')}`];
    if (!isInt(e.visit, 1)) bad.push(`visit ${show(e.visit)} isn't a whole number from 1`);
    if (typeof e.answer !== 'string' || !form.test(e.answer)) bad.push(`${show(e.answer)} isn't an answer of the ${e.checkpoint} checkpoint`);
    if (!['user', 'pre-supplied', 'default'].includes(e.answeredBy)) bad.push('answeredBy is user, pre-supplied or default');
    if (e.answeredBy === 'user' ? e.rule !== undefined : !text(e.rule)) bad.push(e.answeredBy === 'user' ? "a user's answer has no rule" : 'a pre-supplied or default answer has its rule');
    if (e.answeredBy === 'default' && e.answer !== 'stop') bad.push('a default answer is stop');
  } else if (kind === 'escalation') {
    if (!['D1-gate', 'D2-gate'].includes(e.stage)) bad.push('stage is D1-gate or D2-gate');
    if (!CARD.test(String(e.concept))) bad.push(`concept ${show(e.concept)} isn't a card id`);
    if (!/^reports\/gates\/(D[12]-gate)-(r[1-9]\d*-[a-c]-[1-9]\d*)-a[1-9]\d*\.json$/.test(String(e.verdict)) || !String(e.verdict).startsWith(`reports/gates/${e.stage}-${e.concept}-a`)) bad.push("verdict is the escalated attempt's file, reports/gates/<stage>-<concept>-a<attempt>.json");
    if (!['accept', 'retry', 'verification', 'stop'].includes(e.choice)) bad.push('choice is accept, retry, verification or stop');
    if (e.choice === 'retry' ? !text(e.guidance) : e.guidance !== undefined) bad.push('guidance goes with retry, and only with it');
  } else if (kind === 'set') {
    if (e.status !== undefined && !STATUSES.includes(e.status)) bad.push(`status is ${STATUSES.join(', ')}`);
    if (e.roll !== undefined && e.roll !== null && !(isObj(e.roll) && ['className', 'ascendancy', 'skill'].every((k) => text(e.roll[k])) && Object.keys(e.roll).length === 3)) bad.push('roll is null or {className, ascendancy, skill}');
    if (e.outputs !== undefined && !(isObj(e.outputs) && Object.keys(e.outputs).every((k) => OUTPUTS.includes(k)) && OUTPUTS.every((k) => e.outputs[k] === null || text(e.outputs[k])))) bad.push(`outputs is {${OUTPUTS.join(', ')}}, each a path or null`);
    if (e.faults !== undefined && !(Array.isArray(e.faults) && e.faults.every((f) => isObj(f) && text(f.id) && isObj(f.target) && isInt(f.applied, 0) && typeof f.observed === 'string'))) bad.push('faults is a list of {id, target, applied, observed}');
  } else if (kind === 'init') {
    if (!text(e.slug)) bad.push('slug is the run folder\'s slug');
    if (!isObj(e.brief)) bad.push('brief is the parsed brief, {} for an empty one');
    if (!['offline', 'online'].includes(e.mode)) bad.push('mode is offline or online');
    if (!['none', 'accepted', 'refused'].includes(e.testConfig)) bad.push('testConfig is none, accepted or refused');
    if (e.status !== undefined && !['running', 'stopped'].includes(e.status)) bad.push('a first write\'s status is running, or stopped for a refused test config');
  }
  return bad;
}

/** Applies one write to the run folder's log. Returns what it did, or throws an Error saying why not. */
export function writeLog(runFolder, kind, entry) {
  const file = path.join(runFolder, 'run-log.json');
  const problems = entryProblems(kind, entry);
  if (problems.length > 0) throw new Error(`${kind} entry refused: ${problems.join('; ')}`);
  let log;
  if (kind === 'init') {
    if (fs.existsSync(file)) throw new Error('run-log.json exists; init writes the first log only');
    log = {
      schemaVersion: 3, runFolder: path.resolve(runFolder), slug: entry.slug, brief: entry.brief, roll: null, status: entry.status ?? 'running',
      mode: entry.mode, testConfig: entry.testConfig, stages: [], checkpoints: [], displays: [], escalations: [], faults: [],
      outputs: { plan: null, record: null, dossier: null, guide: null, pobFile: null },
    };
  } else {
    log = readLog(file);
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && !(Array.isArray(log.displays) && log.displays.some((d) => isObj(d) && d.checkpoint === entry.checkpoint && d.visit === entry.visit))) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s visit ${entry.visit} printed no display; run run-log.mjs <runFolder> display ${entry.checkpoint} first and print its output (D-367)`);
    }
    const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
    if (list) {
      if (!Array.isArray(log[list])) log[list] = [];
      log[list].push(Object.fromEntries(FIELDS[kind].filter((k) => entry[k] !== undefined).map((k) => [k, entry[k]])));
    } else Object.assign(log, entry);
  }
  saveLog(file, log);
  const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
  return list ? `${list}[${log[list].length - 1}]` : kind === 'init' ? 'the first log' : Object.keys(entry).join(', ');
}

/** The log at `file`, schema 3, or throws an Error saying why not. */
function readLog(file) {
  let log;
  try {
    log = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`run-log.json can't be read (${err.code ?? err.message}); write the first log with init`);
  }
  if (!isObj(log) || log.schemaVersion !== 3) throw new Error('run-log.json isn\'t a schema-3 log; this script writes only schema 3');
  return log;
}

function saveLog(file, log) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(log, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------------------------------------------
// The gate displays (D-367, D-369; ../references/checkpoints.md)
// ---------------------------------------------------------------------------------------------------

const gateName = (gate) => (gate === 'escalation' ? 'the escalation question' : `the ${gate} gate`);
const stagesOf = (log) => (Array.isArray(log.stages) ? log.stages.filter(isObj) : []);
const objects = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
/** The last logged attempt of one of `names` that returned its file. */
const lastStage = (log, names) => stagesOf(log).filter((s) => names.includes(s.stage) && s.outcome !== 'missing').pop();
const verdictFile = (s) => `reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`;
const whole = (v) => (Number.isFinite(v) ? String(Math.round(v)) : '—');
const parts = (v) => (isObj(v) ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join(', ') : 'none');

function readText(dir, rel) {
  try {
    return fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
  } catch {
    return null;
  }
}
function readJson(dir, rel) {
  const t = readText(dir, rel);
  try {
    return t === null ? null : JSON.parse(t);
  } catch {
    return null;
  }
}

/** The Arbiter's verdict with its worst ratio: the D1 gate's text as written, or the record's `measures.arbiter`. */
function arbiterText(a) {
  if (typeof a === 'string') return a;
  if (!isObj(a) || !isObj(a.worst) || !Number.isFinite(a.worst.ratio)) return 'not measured';
  return `${a.verdict}, worst ${String(a.worst.type).split('-').join(' and ')} ${a.worst.ratio.toFixed(2)}`;
}
/** A rung's figures, as the design gate shows them: DPS, EHP, the Arbiter on b and n, and the rough clear speed. */
function figures(r) {
  const clear = typeof r.clearSpeed === 'string' ? r.clearSpeed : (r.clearSpeed?.speed ?? 'not measured');
  return [`DPS ${whole(r.dps)}`, `EHP ${whole(r.ehp)}`, ...(r.arbiter ? [`Arbiter ${arbiterText(r.arbiter)}`] : []), `clear ${clear} (rough)`].join(', ');
}

function brainstormDisplay(dir, log) {
  const brief = isObj(log.brief) ? Object.entries(log.brief).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : '';
  const out = [`Brief: ${brief || 'none (surprise me)'}`, ''];
  const deck = readText(dir, 'cards.md');
  if (deck === null) return [...out, 'No cards.md in the run folder.'];
  // Every dealt card not verified yet, and the "Not dealt" list.
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  out.push(...deck.trimEnd().split('\n').filter((l) => !verified.has(/^- (r[1-9]\d*-[a-c]-[1-9]\d*) /.exec(l)?.[1])));
  const short = lastStage(log, ['R1a-assemble'])?.shortReason;
  if (text(short)) out.push('', `A short round: ${short}`);
  return out;
}

function verificationDisplay(dir, log) {
  const dossier = readText(dir, 'dossier.md');
  const out = dossier === null ? ['No dossier.md in the run folder.'] : dossier.split('\n').filter((l) => l.startsWith('|'));
  out.push('', `Dossier: ${path.join(dir, 'dossier.md')}`);
  const lastR1b = new Map();
  for (const s of stagesOf(log)) if (s.stage === 'R1b' && s.outcome !== 'missing') lastR1b.set(s.concept, s);
  for (const s of lastR1b.values()) if (s.outcome === 'fail') out.push(`${s.concept} failed: ${verdictFile(s)}`);
  // Back from a design (infeasible, an escalation, the design gate's verification): that card's evidence.
  const back = lastStage(log, ['D1-gate', 'D2-gate']);
  if (back) out.push(`Last design verdict, ${back.concept} (${back.outcome}): ${verdictFile(back)}`);
  return out;
}

function designDisplay(dir, log) {
  const s = lastStage(log, ['D1-gate']);
  if (!s) return ['No D1 gate in the run log.'];
  const file = verdictFile(s);
  const gate = readJson(dir, file);
  if (!isObj(gate?.design)) return [`${file} has no design field.`];
  const out = [];
  for (const r of objects(gate.design.rungs)) {
    out.push(`${r.stage}: ${figures(r)}`);
    for (const k of ['anoint', 'gear', 'gems', 'tree']) if (text(r[k])) out.push(`   ${k}: ${r[k]}`);
  }
  const estimates = Array.isArray(gate.design.estimates) ? gate.design.estimates.filter(text) : [];
  if (estimates.length > 0) out.push('', 'Open estimates:', ...estimates.map((e) => `- ${e}`));
  out.push('', `Verdict: ${parts(gate.verdict)}`, `Verdict file: ${file}`);
  return out;
}

async function finalDisplay(dir, log) {
  const out = [`Guide: ${path.join(dir, 'guide.md')}`, `Audit: ${path.join(dir, 'audit.md')}`];
  const d1 = lastStage(log, ['D1-gate']);
  const d2 = lastStage(log, ['D2-gate']);
  const d1gate = d1 ? readJson(dir, verdictFile(d1)) : null;
  const d2gate = d2 ? readJson(dir, verdictFile(d2)) : null;
  out.push(`PoB file: ${d2gate?.finalCompile?.pobFile ?? 'none: no final compile'}`);
  for (const [s, g] of [[d1, d1gate], [d2, d2gate]]) if (s) out.push(`${s.stage}: ${parts(g?.verdict)} (${verdictFile(s)})`);
  // D-369: each endgame rung's figures from the final record, and the design gate's where they moved since.
  const plan = readJson(dir, 'plan.json');
  const record = readJson(dir, 'compile-record.json');
  const atDesign = new Map(objects(d1gate?.design?.rungs).map((r) => [r.stage, r]));
  out.push('', 'Endgame, from the final compile record:');
  for (const variant of RUNGS) {
    const st = objects(plan?.stages).find((x) => x.variant === variant);
    if (!st) continue;
    const m = record?.stages?.[st.id]?.measures ?? {};
    const now = figures({ dps: m.dps, ehp: m.ehp, arbiter: variant === 'entering-maps' ? null : (m.arbiter ?? 'not measured'), clearSpeed: m.clearSpeed });
    out.push(`${st.id}: ${now}`);
    const then = atDesign.get(st.id);
    if (then && figures(then) !== now) out.push(`   at the design gate: ${figures(then)}`);
  }
  const guide = readText(dir, 'guide.md');
  const lines = guide === null ? [] : guide.split('\n');
  const at = lines.indexOf('### Known issues');
  const end = lines.findIndex((l, i) => i > at && /^#{1,3} /.test(l));
  const issues = at < 0 ? [] : lines.slice(at + 1, end < 0 ? undefined : end).filter((l) => l.trim() !== '');
  out.push('', 'Known issues:', ...(issues.length > 0 ? issues : ['None.']));
  if (objects(plan?.prices).some((p) => p.status === 'unavailable')) out.push('', 'Some prices are unavailable, so no rung can be claimed to be within its budget (D-164).');
  if (log.mode === 'offline') out.push('The guide is from an offline run: no price was checked.');
  let result;
  try {
    const { checkRun } = await import('./check-run.mjs');
    const violations = await checkRun(dir);
    result = violations.length === 0 ? ['Run checker: ok'] : [`Run checker: ${violations.length} violation(s)`, ...violations.map((v) => `  [${v.rule}] ${v.message}`)];
  } catch (e) {
    result = [`Run checker: didn't run (${e.message})`];
  }
  out.push('', ...result);
  return out;
}

function escalationDisplay(dir, log) {
  const s = stagesOf(log).filter((x) => x.outcome === 'escalated').pop();
  if (!s) return ['No escalated gate attempt in the run log.'];
  const file = verdictFile(s);
  const gate = readJson(dir, file);
  const attempts = stagesOf(log).filter((x) => x.stage === s.stage && x.concept === s.concept);
  return [
    `${s.stage}, ${s.concept}: attempts ${attempts.map((a) => `${a.attempt} ${a.outcome}`).join(', ')}`,
    `Verdict: ${parts(gate?.verdict)}`,
    ...objects(gate?.findings).map((f) => `- ${f.part ?? '—'} ${f.code ?? '—'}: ${f.message ?? ''}`),
    `Verdict file: ${file}`,
  ];
}

const DISPLAYS = { brainstorm: brainstormDisplay, verification: verificationDisplay, design: designDisplay, final: finalDisplay, escalation: escalationDisplay };

/**
 * Builds the display of a gate's next visit from the run folder, records the visit in `displays[]` (once), and
 * returns the display's text. Throws an Error saying why not.
 */
export async function display(runFolder, gate) {
  if (!DISPLAYED.includes(gate)) throw new Error(`display: ${JSON.stringify(gate)} isn't one of ${DISPLAYED.join(', ')}`);
  const file = path.join(runFolder, 'run-log.json');
  const log = readLog(file);
  const visit = (Array.isArray(log.checkpoints) ? log.checkpoints.filter((c) => isObj(c) && c.checkpoint === gate).length : 0) + 1;
  const body = await DISPLAYS[gate](runFolder, log);
  if (!Array.isArray(log.displays)) log.displays = [];
  if (!log.displays.some((d) => isObj(d) && d.checkpoint === gate && d.visit === visit)) {
    log.displays.push({ checkpoint: gate, visit });
    saveLog(file, log);
  }
  const title = gate === 'escalation' ? `## Escalation, visit ${visit}` : `## The ${gate} gate, visit ${visit}`;
  return `${[title, '', ...body].join('\n')}\n`;
}

async function main(argv) {
  const args = argv.slice(2);
  const kinds = ['init', 'stage', 'checkpoint', 'escalation', 'set', 'display'];
  if (args.length !== 3 || !kinds.includes(args[1])) {
    process.stderr.write(`usage: node run-log.mjs <runFolder> <${kinds.slice(0, -1).join('|')}> '<json>' | -  (- reads the JSON from stdin), or <runFolder> display <${DISPLAYED.join('|')}>\n`);
    return 2;
  }
  if (args[1] === 'display') {
    try {
      process.stdout.write(await display(path.resolve(args[0]), args[2]));
      return 0;
    } catch (e) {
      process.stderr.write(`run-log: ${e.message}\n`);
      return 1;
    }
  }
  let entry;
  try {
    entry = JSON.parse(args[2] === '-' ? fs.readFileSync(0, 'utf8') : args[2]);
  } catch (e) {
    process.stderr.write(`run-log: the entry isn't JSON: ${e.message}\n`);
    return 1;
  }
  try {
    const what = writeLog(path.resolve(args[0]), args[1], entry);
    process.stdout.write(`run-log: wrote ${what}\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`run-log: ${e.message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv);
}
