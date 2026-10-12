#!/usr/bin/env node
// The build-guide run log's writer (D-356): the runner writes run-log.json only through it, never with Write.
//
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> init '{"slug", "brief", "mode", "testConfig"[, "status"]}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> stage '{"stage", "concept"?, "attempt", "outcome", …}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> checkpoint '{"checkpoint", "visit", "answer", "answeredBy", "rule"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> escalation '{"stage", "concept", "verdict", "choice", "guidance"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> set '{"status"?, "roll"?, "outputs"?, "faults"?}'
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
// Exit 0: written (one line on stdout). Exit 1: refused (stderr). Exit 2: usage error.

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
      mode: entry.mode, testConfig: entry.testConfig, stages: [], checkpoints: [], escalations: [], faults: [],
      outputs: { plan: null, record: null, dossier: null, guide: null, pobFile: null },
    };
  } else {
    try {
      log = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`run-log.json can't be read (${err.code ?? err.message}); write the first log with init`);
    }
    if (!isObj(log) || log.schemaVersion !== 3) throw new Error('run-log.json isn\'t a schema-3 log; this script writes only schema 3');
    const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
    if (list) {
      if (!Array.isArray(log[list])) log[list] = [];
      log[list].push(Object.fromEntries(FIELDS[kind].filter((k) => entry[k] !== undefined).map((k) => [k, entry[k]])));
    } else Object.assign(log, entry);
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(log, null, 2)}\n`);
  fs.renameSync(tmp, file);
  const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
  return list ? `${list}[${log[list].length - 1}]` : kind === 'init' ? 'the first log' : Object.keys(entry).join(', ');
}

function main(argv) {
  const args = argv.slice(2);
  const kinds = ['init', 'stage', 'checkpoint', 'escalation', 'set'];
  if (args.length !== 3 || !kinds.includes(args[1])) {
    process.stderr.write(`usage: node run-log.mjs <runFolder> <${kinds.join('|')}> '<json>' | -  (- reads the JSON from stdin)\n`);
    return 2;
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
  process.exitCode = main(process.argv);
}
