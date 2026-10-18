#!/usr/bin/env node
// The build-guide run log's writer (D-356): the runner writes run-log.json only through it, never with Write.
//
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> init '{"slug", "brief", "mode", "testConfig"[, "status"]}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> stage '{"stage", "concept"?, "attempt", "outcome", …}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> checkpoint '{"checkpoint", "visit", "answer", "answeredBy", "rule"?, "questions"?, "changes"?, "newCards"?, "note"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> escalation '{"stage", "concept", "verdict", "choice", "guidance"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> set '{"status"?, "roll"?, "outputs"?, "faults"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display <brainstorm|verification|design|final|escalation>
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> test-config <path>
//
// `-` in place of the JSON reads the entry from stdin, as a quoted heredoc gives it, so a text with an apostrophe
// (a brief's notes, a `revise:` text, a retry's guidance, a final-gate note, a gate change's words) needs no shell
// quoting:
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
// A gate's checkpoint (amendment 7: D-389, D-391) also carries `questions`, how many questions the user asked at
// that visit (its interview notes, `interviews/<gate>-<visit>.md`, hold as many); `changes`, the revisions riding
// on picked cards, `{"<card id>": "<the user's words>"}`; `newCards`, the cards made at the gate,
// `[{"id": "r<k>-g-<n>", "name", "from": ["<card id>", …], "words"}]` (k the latest brainstorm round, n counting the
// run's gate-made cards of that round), with a brainstorm `pick:` or a verification `verify:`, the picks and the
// new cards 1–3 together (a pick of new cards only is `pick:` or `verify:` with no id); and `note`, the
// brainstorm-more answer's note. A new card's `from` names cards the deck (`cards.md`) holds, and its name is one no
// card of the run has.
//
// `display <gate>` (D-367, D-392) prints that gate visit's display on stdout, in plain words built from the run
// folder's files: card names, never ids, with the codes, ids and file paths last, under "For reference". It records
// the visit in `displays[]` as `{checkpoint, visit}`, the visit one more than the gate's checkpoints[] entries;
// printing it again records nothing new. A gate's `checkpoint` entry is refused until its visit's display is
// recorded. The final gate's display runs the run checker and carries each endgame rung's final figures (D-369)
// and its budget line, the total range at its price day with its over-target slots (D-371, D-374).
//
// `test-config <path>` (D-394) checks a test config's shape and writes nothing: each gate's answers are strings, or
// objects `{ask, answer, changes, newCards, note}` scripting an interview. What needs the deck (a new card's `from`
// and its name) is checked when the gate's checkpoint is written.
// Exit 0: written, the display printed (stdout), or the test config well formed. Exit 1: refused (stderr). Exit 2:
// usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A card id (D-319): `r<round>-<letter>-<n>`, the letters a to c a brainstorm round's researchers', g a card made at a gate (D-391). */
export const CARD_ID = 'r[1-9]\\d*-[a-cg]-[1-9]\\d*';
const CARD = new RegExp(`^${CARD_ID}$`);
/** A card made at a gate (D-391): `r<k>-g-<n>`. */
const GATE_CARD = /^r([1-9]\d*)-g-([1-9]\d*)$/;
const IDS = `${CARD_ID}(?:,${CARD_ID}){0,2}`;
const TRADE_KINDS = ['no_session', 'session_rejected', 'too_complex', 'invalid_query', 'rate_limited', 'locked_out', 'would_wait', 'auth', 'http', 'network', 'timeout', 'disabled'];
/** Each stage and its outcomes (run-log.md); every step may also be `missing`. `Q` is a gate question step (D-390). */
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
  Q: ['done'],
};
const NO_CONCEPT = ['R1a', 'R1a-assemble', 'R1b-assemble', 'Q'];
const PRICING = ['R1b', 'D1-finish', 'D1-gate', 'D2'];
/**
 * Each gate's or question's answers (run-log.md, D-362). A brainstorm `pick:` or a verification `verify:` with no
 * id picks only the new cards its `newCards` makes (D-391).
 */
const ANSWERS = {
  brainstorm: new RegExp(`^(?:pick:(?:${IDS})?|more|stop)$`),
  verification: new RegExp(`^(?:pick:${CARD_ID}|verify:(?:${IDS})?|more|stop)$`),
  design: /^(?:accept|revise:.+|verification|stop)$/s,
  final: /^.+$/s,
  'unsaved-build': /^(?:proceed|stop)$/,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
/** A test config's answers per gate (offline-and-test.md, D-323, D-362): the runner resolves first-n and first-viable. */
const CONFIG_ANSWERS = {
  brainstorm: new RegExp(`^(?:pick:(?:${IDS})?|first-n:[1-3]|more|stop)$`),
  verification: new RegExp(`^(?:first-viable|pick:${CARD_ID}|verify:(?:${IDS})?|more|stop)$`),
  design: /^(?:accept|revise:.+|verification|stop)$/s,
  final: /^(?:accept|not-accept|revise:.+)$/s,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
const STATUSES = ['running', 'completed', 'not-accepted', 'stopped', 'escalated'];
/** Each kind's fields, in the order run-log.md writes them. */
const FIELDS = {
  stage: ['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes', 'probes', 'shortReason'],
  checkpoint: ['checkpoint', 'visit', 'answer', 'answeredBy', 'rule', 'questions', 'changes', 'newCards', 'note'],
  escalation: ['stage', 'concept', 'verdict', 'choice', 'guidance'],
  set: ['status', 'roll', 'outputs', 'faults'],
  init: ['slug', 'brief', 'mode', 'testConfig', 'status'],
};
const NEW_CARD_FIELDS = ['id', 'name', 'from', 'words'];
const OUTPUTS = ['plan', 'record', 'dossier', 'guide', 'pobFile'];
/** The gates and the question whose visits print a display first (D-265, D-367); the unsaved-build question has none. */
export const DISPLAYED = ['brainstorm', 'verification', 'design', 'final', 'escalation'];
/** The endgame rungs, in ladder order (the plan's `variant`). */
const RUNGS = ['entering-maps', 'budget', 'non-budget'];
const RUNG_LABEL = { 'entering-maps': 'Entering maps', budget: 'Budget endgame', 'non-budget': 'Non-budget endgame' };
/** The most picks and new cards one answer verifies (D-287, D-391). */
const PICK_CAP = 3;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v, min) => Number.isInteger(v) && v >= min;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const text = (v) => typeof v === 'string' && v.trim() !== '';
const show = (v) => JSON.stringify(v);
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
/** The card ids a `pick:` or `verify:` answer names; none for any other answer. */
const idsOf = (answer) => (/^(?:pick|verify):(.*)$/s.exec(String(answer))?.[1] ?? '').split(',').filter((x) => x !== '');
/** Whether a gate's answer picks cards that changes may ride on (D-391): a brainstorm pick, a verification pick or verify. */
const picks = (gate, answer) => (gate === 'brainstorm' && /^pick:/.test(answer)) || (gate === 'verification' && /^(?:pick|verify):/.test(answer));
/** Whether a gate's answer may make new cards (D-391): a brainstorm pick, a verification verify. */
const makes = (gate, answer) => (gate === 'brainstorm' && /^pick:/.test(answer)) || (gate === 'verification' && /^verify:/.test(answer));

/**
 * The problems with the interview parts of a gate's answer (D-391, D-394), shared by a checkpoint entry and a test
 * config's object entry: `changes` keyed by the cards the answer picks, `newCards` only with a pick that may make
 * them, the picks and the new cards 1–3 together, and `note` only with `more`. `newCard` checks one new card's own
 * fields.
 */
function choiceProblems(gate, e, newCard) {
  const bad = [];
  const answer = String(e.answer);
  const ids = idsOf(answer);
  if (e.changes !== undefined) {
    if (!picks(gate, answer)) bad.push(`changes rides on picked cards: the brainstorm gate's pick:<ids>, or the verification gate's pick:<id> or verify:<ids>, not ${show(e.answer)} (D-391)`);
    else if (!isObj(e.changes) || Object.keys(e.changes).length === 0 || !Object.values(e.changes).every(text)) bad.push('changes is {"<card id>": "<the user\'s words>", …}, one or more');
    else for (const id of Object.keys(e.changes)) if (!ids.includes(id)) bad.push(`changes names ${id}, which the answer ${show(e.answer)} doesn't pick; a revision rides on a picked card (D-391)`);
  }
  const made = Array.isArray(e.newCards) ? e.newCards.length : 0;
  if (e.newCards !== undefined) {
    if (!makes(gate, answer)) bad.push(`newCards goes with the brainstorm gate's pick: or the verification gate's verify:, not ${show(e.answer)} (D-391)`);
    else if (made === 0) bad.push('newCards lists one or more new cards');
    else {
      e.newCards.forEach((c, i) => bad.push(...newCard(c).map((p) => `newCards[${i}] ${p}`)));
      const names = e.newCards.filter(isObj).map((c) => norm(c.name));
      if (new Set(names).size !== names.length) bad.push('newCards names two cards alike; every name is unique (D-392)');
    }
  }
  if (makes(gate, answer) && ids.length === 0 && made === 0) bad.push(`${show(e.answer)} picks no card; a pick names 1–${PICK_CAP} cards, or makes a new one with newCards (D-391)`);
  if (picks(gate, answer) && ids.length + made > PICK_CAP) bad.push(`the answer picks ${ids.length} card(s) and makes ${made}: ${ids.length + made} over ${PICK_CAP}; a pick verifies 1–${PICK_CAP} cards, new cards included (D-391)`);
  if (new Set(ids).size !== ids.length) bad.push(`${show(e.answer)} names a card twice`);
  if (e.note !== undefined) {
    if (e.answer !== 'more' || !['brainstorm', 'verification'].includes(gate)) bad.push(`note goes with more, the brainstorm-more answer, not ${show(e.answer)} (D-391)`);
    else if (!text(e.note)) bad.push("note is the user's note, a non-empty text");
  }
  return bad;
}

/** A new card on a checkpoint (D-391): `{id: "r<k>-g-<n>", name, from: [<card id>, …], words}`. */
function newCardProblems(c) {
  if (!isObj(c)) return ['is {"id", "name", "from", "words"}'];
  const bad = Object.keys(c).filter((k) => !NEW_CARD_FIELDS.includes(k)).map((k) => `has "${k}", which isn't one of ${NEW_CARD_FIELDS.join(', ')}`);
  if (!GATE_CARD.test(String(c.id))) bad.push(`id ${show(c.id)} isn't a gate-made card's id r<k>-g-<n> (D-391)`);
  return [...bad, ...newCardBody(c)];
}
/** A new card's name, `from` and words, as a checkpoint and a test config give them. */
function newCardBody(c) {
  const bad = [];
  if (!text(c.name)) bad.push('has its name, the player\'s name for the build (D-392)');
  if (!Array.isArray(c.from) || c.from.length === 0 || !c.from.every((id) => CARD.test(String(id)))) bad.push('from lists the card ids it draws on, one or more');
  else if (new Set(c.from).size !== c.from.length) bad.push('from names a card twice');
  if (!text(c.words)) bad.push("has words, the user's words for the card");
  return bad;
}

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
    if (e.questions !== undefined) {
      if (!DISPLAYED.includes(e.checkpoint)) bad.push("questions is only on a gate's or an escalation's answer; the unsaved-build question is a fixed question (D-389)");
      else if (!isInt(e.questions, 0)) bad.push(`questions ${show(e.questions)} isn't a whole number from 0, how many questions the user asked at the visit (D-389)`);
      else if (e.answeredBy === 'default' && e.questions > 0) bad.push('a default answer has no questions: nobody asked any');
    }
    if (typeof e.answer === 'string') bad.push(...choiceProblems(e.checkpoint, e, newCardProblems));
  } else if (kind === 'escalation') {
    if (!['D1-gate', 'D2-gate'].includes(e.stage)) bad.push('stage is D1-gate or D2-gate');
    if (!CARD.test(String(e.concept))) bad.push(`concept ${show(e.concept)} isn't a card id`);
    if (!new RegExp(`^reports/gates/(D[12]-gate)-(${CARD_ID})-a[1-9]\\d*\\.json$`).test(String(e.verdict)) || !String(e.verdict).startsWith(`reports/gates/${e.stage}-${e.concept}-a`)) bad.push("verdict is the escalated attempt's file, reports/gates/<stage>-<concept>-a<attempt>.json");
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

/** How many brainstorm rounds the log ran: its runs of R1a entries (run-log.md, "Rounds, read from the gates"). */
const brainstormRounds = (log) => stagesOf(log).filter((s, i, all) => s.stage === 'R1a' && all[i - 1]?.stage !== 'R1a').length;

/**
 * The problems of a checkpoint's new cards against the run (D-391, D-392): each id `r<k>-g-<n>`, k the latest
 * brainstorm round and n the next of the run's gate-made cards in it, in order; `from` naming cards the deck holds;
 * a name no card of the run has.
 */
function newCardsAgainstRun(runFolder, log, entry) {
  if (!Array.isArray(entry.newCards) || entry.newCards.length === 0) return [];
  const bad = [];
  const k = brainstormRounds(log);
  const earlier = objects(log.checkpoints).flatMap((c) => objects(c.newCards));
  let n = earlier.filter((c) => GATE_CARD.exec(String(c.id))?.[1] === String(k)).length;
  const deck = parseDeck(readText(runFolder, 'cards.md'));
  const held = new Set(deck.entries.map((d) => d.id));
  const taken = new Map(deck.entries.filter((d) => text(d.name)).map((d) => [norm(d.name), d.id]));
  for (const c of earlier) if (text(c.name)) taken.set(norm(c.name), c.id);
  for (const id of listCards(runFolder)) {
    const name = parseCard(readText(runFolder, `cards/${id}.md`)).name;
    if (text(name)) taken.set(norm(name), id);
  }
  entry.newCards.forEach((c, i) => {
    n += 1;
    if (k === 0) bad.push(`newCards[${i}]: no brainstorm round has run, so there is no deck to draw on`);
    else if (c.id !== `r${k}-g-${n}`) bad.push(`newCards[${i}] has id ${show(c.id)}; the next card made at a gate is r${k}-g-${n}: round ${k} is the latest brainstorm round, and the run has made ${n - 1} gate card(s) in it (D-391)`);
    for (const id of c.from) if (!held.has(id)) bad.push(`newCards[${i}] draws on ${id}, which the deck (cards.md) doesn't hold (D-391)`);
    const clash = taken.get(norm(c.name));
    if (clash !== undefined) bad.push(`newCards[${i}] is named ${show(c.name)}, which card ${clash} already has; a name is never reused (D-392)`);
  });
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
    const expected = (Array.isArray(log.checkpoints) ? log.checkpoints.filter((c) => isObj(c) && c.checkpoint === entry.checkpoint).length : 0) + 1;
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && entry.visit !== expected) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s next visit is ${expected}, not ${entry.visit}`);
    }
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && !(Array.isArray(log.displays) && log.displays.some((d) => isObj(d) && d.checkpoint === entry.checkpoint && d.visit === entry.visit))) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s visit ${entry.visit} printed no display; run run-log.mjs <runFolder> display ${entry.checkpoint} first and print its output (D-367)`);
    }
    if (kind === 'checkpoint') {
      const against = newCardsAgainstRun(runFolder, log, entry);
      if (against.length > 0) throw new Error(`checkpoint entry refused: ${against.join('; ')}`);
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
// The test config (D-394; ../references/offline-and-test.md)
// ---------------------------------------------------------------------------------------------------

const CONFIG_GATES = ['brainstorm', 'verification', 'design', 'final', 'escalation'];
const ENTRY_FIELDS = ['ask', 'answer', 'changes', 'newCards', 'note'];
const FAULT_IDS = ['FI-1', 'FI-2', 'FI-3'];

/** One answer entry of a test config: a string, or an object scripting an interview (D-394). */
function configEntryProblems(gate, entry) {
  if (typeof entry === 'string') {
    if (!CONFIG_ANSWERS[gate].test(entry)) return [`${show(entry)} isn't an answers.${gate} value`];
    return makes(gate, entry) && idsOf(entry).length === 0 ? [`${show(entry)} picks no card; a string answer names 1–${PICK_CAP} cards`] : [];
  }
  if (!isObj(entry)) return ['is a string, or an object {ask, answer, changes, newCards, note}'];
  const bad = Object.keys(entry).filter((k) => !ENTRY_FIELDS.includes(k)).map((k) => `"${k}" isn't a field of an answer entry (${ENTRY_FIELDS.join(', ')})`);
  if (typeof entry.answer !== 'string' || !CONFIG_ANSWERS[gate].test(entry.answer)) return [...bad, `answer ${show(entry.answer)} isn't an answers.${gate} value`];
  if (entry.ask !== undefined && !(Array.isArray(entry.ask) && entry.ask.every(text))) bad.push('ask lists the questions to ask before the answer, none of them empty');
  if (!['brainstorm', 'verification'].includes(gate)) {
    for (const k of ['changes', 'newCards', 'note']) if (entry[k] !== undefined) bad.push(`${k} is only on a brainstorm or verification answer (D-391)`);
    return bad;
  }
  // The runner assigns a new card's id (D-394), so the config gives only its name, the cards it draws on and the words.
  const newCard = (c) => (isObj(c) ? [...Object.keys(c).filter((k) => k !== 'id' && !NEW_CARD_FIELDS.includes(k)).map((k) => `has "${k}", which isn't one of name, from, words`), ...('id' in c ? ['has an id, which the runner assigns'] : []), ...newCardBody(c)] : ['is {"name", "from", "words"}']);
  return [...bad, ...choiceProblems(gate, entry, newCard)];
}

/** The problems with a parsed test config (offline-and-test.md, D-323, D-394); none when it is well formed. */
export function testConfigProblems(cfg) {
  if (!isObj(cfg)) return ['the test config is a JSON object {answers, faults?}'];
  const bad = Object.keys(cfg).filter((k) => !['answers', 'faults'].includes(k)).map((k) => `"${k}" isn't a test-config key (answers, faults)`);
  const a = cfg.answers;
  if (!isObj(a)) return [...bad, 'answers is an object of each gate\'s answers'];
  for (const k of Object.keys(a)) {
    if (['checkpoint1', 'checkpoint2'].includes(k)) bad.push(`answers.${k} is retired with the run log's schema 3; the gates' answers are answers.brainstorm, answers.verification, answers.design and answers.final (D-323)`);
    else if (![...CONFIG_GATES, 'unsavedBuild'].includes(k)) bad.push(`answers.${k} isn't one of ${[...CONFIG_GATES, 'unsavedBuild'].map((g) => `answers.${g}`).join(', ')}`);
  }
  if (a.unsavedBuild !== undefined && !['proceed', 'stop'].includes(a.unsavedBuild)) bad.push('answers.unsavedBuild is proceed or stop');
  for (const gate of CONFIG_GATES) {
    if (a[gate] === undefined) continue;
    if (!Array.isArray(a[gate])) {
      bad.push(`answers.${gate} is a list, one entry per visit`);
      continue;
    }
    a[gate].forEach((entry, i) => bad.push(...configEntryProblems(gate, entry).map((p) => `answers.${gate}[${i}]: ${p}`)));
  }
  if (cfg.faults !== undefined) {
    if (!Array.isArray(cfg.faults)) bad.push('faults is a list of {id, concepts, persistent?}');
    else {
      cfg.faults.forEach((f, i) => {
        const ok = isObj(f) && FAULT_IDS.includes(f.id) && (f.concepts === 'all' || (Array.isArray(f.concepts) && f.concepts.length > 0 && f.concepts.every((c) => CARD.test(String(c)))))
          && (f.persistent === undefined || typeof f.persistent === 'boolean') && Object.keys(f).every((k) => ['id', 'concepts', 'persistent'].includes(k));
        if (!ok) bad.push(`faults[${i}] is {id: ${FAULT_IDS.join(' | ')}, concepts: "all" | [<card id>, …], persistent?}`);
      });
    }
  }
  return bad;
}

// ---------------------------------------------------------------------------------------------------
// The cards and the deck, as the displays and the run checker read them (D-391, D-392)
// ---------------------------------------------------------------------------------------------------

/** The Pitch fields a card's display prints, in order (D-392; templates/card-template.md). */
export const PITCH_LINES = ['Why pick it', 'How it clears', 'Bosses', 'Needs', 'The catch'];
/** The deck's H2s around its rounds (D-392): the header before them, the not-dealt cards and the unused findings after. */
export const DECK_HEADER = ['What the cards share', 'How they differ'];
export const DECK_FOOTER = ['Not dealt', 'Found, not used'];
/** The mark on a gate-made card's deck line (D-391). */
export const MADE_MARK = 'made at the gate';

/**
 * A card file's Pitch (D-392): each top-level item `- <Field>: <text>` under `### Pitch`, its indented lines
 * joined to it (a nested item with "; "). Returns `{name, fields, changed, made}`: the name (`Name`, or a card from
 * before amendment 7's `Title`), every field by its name, and the gate lines R1b adds, `- Changed at the gate (visit
 * <n>): <words>` and `- Made at the gate (visit <n>): from <name> and <name>: <words>`, each `{visit, text, line}`.
 */
export function parseCard(textOrNull) {
  const out = { name: null, fields: new Map(), changed: [], made: [] };
  if (typeof textOrNull !== 'string') return out;
  const lines = textOrNull.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
  const at = lines.findIndex((l) => /^###\s+Pitch\s*$/.test(l));
  if (at < 0) return out;
  let last = null;
  for (let i = at + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i += 1) {
    const l = lines[i];
    const top = /^[-*]\s+([^:]+?):\s*(.*)$/.exec(l);
    if (top) {
      last = { key: top[1].trim(), value: top[2].trim(), line: i + 1 };
      const gate = /^(Changed|Made) at the gate \(visit ([1-9]\d*)\)$/.exec(last.key);
      if (gate) (gate[1] === 'Changed' ? out.changed : out.made).push({ visit: Number(gate[2]), text: last.value, line: i + 1, ref: last });
      else out.fields.set(last.key, last);
    } else if (last && /^\s+\S/.test(l)) {
      const nested = /^\s+[-*]\s+(.*)$/.exec(l);
      last.value = nested ? `${last.value}${last.value === '' ? '' : '; '}${nested[1].trim()}` : `${last.value} ${l.trim()}`;
    } else if (l.trim() !== '') last = null;
  }
  for (const g of [...out.changed, ...out.made]) g.text = g.ref.value;
  const field = (k) => out.fields.get(k)?.value;
  out.name = text(field('Name')) ? field('Name') : text(field('Title')) ? field('Title') : null;
  return out;
}

/**
 * The deck `cards.md` (D-287, D-391, D-392): its H2s in order, the header's two texts, each line `- <id> "<Name>" |
 * <part> | …` with its section (`Round <k>` or `Not dealt`), and the found-not-used items. A gate-made card's line
 * carries the part `made at the gate (visit <n>): from "<Name>" and "<Name>"`, an under-played one the part
 * `under-played (judgment: <why>)`.
 */
export function parseDeck(textOrNull) {
  const deck = { h2: [], share: null, differ: null, entries: [], found: [], lines: [] };
  if (typeof textOrNull !== 'string') return deck;
  const lines = textOrNull.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
  deck.lines = lines;
  let section = null;
  const body = new Map();
  lines.forEach((raw, i) => {
    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      section = h2[1];
      deck.h2.push(section);
      body.set(section, []);
      return;
    }
    if (/^#\s/.test(raw) || section === null || raw.trim() === '') return;
    body.get(section).push({ raw: raw.trim(), n: i + 1 });
    const item = /^[-*]\s+(.*)$/.exec(raw.trim());
    if (!item) return;
    if (section === 'Found, not used') {
      deck.found.push({ text: item[1].trim(), n: i + 1 });
      return;
    }
    const round = /^Round ([1-9]\d*)$/.exec(section);
    if (!round && section !== 'Not dealt') return;
    const m = /^(\S+)(?:\s+"([^"]*)")?\s*(.*)$/.exec(item[1]);
    const rest = m[3].replace(/^\|\s*/, '');
    const parts = rest === '' ? [] : rest.split(/\s+\|\s+/).map((p) => p.trim());
    deck.entries.push({
      id: m[1], name: m[2] ?? null, parts, raw: raw.trim(), n: i + 1, section, round: round ? Number(round[1]) : null,
      made: parts.find((p) => p.toLowerCase().startsWith(MADE_MARK)) ?? null,
      underPlayed: parts.find((p) => /^under-played\b/i.test(p)) ?? null,
    });
  });
  const paragraph = (title) => (body.has(title) ? body.get(title).map((l) => l.raw).join(' ') : null);
  deck.share = paragraph('What the cards share');
  deck.differ = paragraph('How they differ');
  deck.body = body;
  return deck;
}

// ---------------------------------------------------------------------------------------------------
// The gate displays (D-367, D-369, D-392; ../references/checkpoints.md)
// ---------------------------------------------------------------------------------------------------

const gateName = (gate) => (gate === 'escalation' ? 'the escalation question' : `the ${gate} gate`);
const stagesOf = (log) => (Array.isArray(log.stages) ? log.stages.filter(isObj) : []);
const objects = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
/** The last logged attempt of one of `names` that returned its file. */
const lastStage = (log, names) => stagesOf(log).filter((s) => names.includes(s.stage) && s.outcome !== 'missing').pop();
const verdictFile = (s) => `reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`;
const parts = (v) => (isObj(v) ? Object.entries(v).map(([k, x]) => `${k} ${x}`).join(', ') : 'none');
/** A whole number with thousands separators, as the displays write a figure. */
const whole = (v) => (isNum(v) ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : 'not measured');
/** A card's skeleton stage (R1b.md step 4): its id without hyphens, then `e`. */
const skeletonStage = (id) => `${String(id).replace(/-/g, '')}e`;

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
/** The card ids of the run's card files `cards/<id>.md`. */
function listCards(dir) {
  try {
    return fs.readdirSync(path.join(dir, 'cards')).map((f) => new RegExp(`^(${CARD_ID})\\.md$`).exec(f)?.[1]).filter(Boolean).sort();
  } catch {
    return [];
  }
}

/**
 * The run's cards by id: each one's name and Pitch (its card file's, else its deck line's name), so a display
 * shows names, never ids (D-392). `name(id)` falls back to the id only for a card the run doesn't hold; `plain(t)`
 * puts each card's name in place of its id in a text.
 */
function cardsOf(dir, deck = parseDeck(readText(dir, 'cards.md'))) {
  const cards = new Map();
  for (const id of listCards(dir)) cards.set(id, parseCard(readText(dir, `cards/${id}.md`)));
  for (const d of deck.entries) {
    if (!cards.has(d.id)) cards.set(d.id, parseCard(null));
    if (!text(cards.get(d.id).name) && text(d.name)) cards.get(d.id).name = d.name;
  }
  const name = (id) => cards.get(id)?.name ?? id;
  const plain = (t) => String(t).replace(new RegExp(`\\b${CARD_ID}\\b`, 'g'), (id) => (cards.has(id) ? name(id) : id));
  return { cards, name, plain };
}

/** The Arbiter's verdict in words: the record's `measures.arbiter`, or the D1 gate's text ("survives, worst physical 0.68"). */
function arbiterWords(a) {
  let verdict;
  let type;
  let ratio;
  if (isObj(a) && isObj(a.worst) && isNum(a.worst.ratio)) [verdict, type, ratio] = [a.verdict, String(a.worst.type), a.worst.ratio];
  else if (typeof a === 'string') {
    const m = /^(survives|one-shot)(?:,? worst ([a-z][a-z -]*?) ([\d.]+))?$/.exec(a.trim());
    if (!m) return `the Arbiter of Divinity: ${a}`;
    [verdict, type, ratio] = [m[1], m[2], m[3] === undefined ? undefined : Number(m[3])];
  } else return 'not measured against the Arbiter of Divinity';
  const hit = type === undefined ? null : `${type.split('-').join(' and ')} hit`;
  if (verdict === 'survives') return hit === null ? "survives the Arbiter of Divinity's hits" : `survives the Arbiter of Divinity's hits (its worst, a ${hit}, is ${ratio.toFixed(2)} of your max hit)`;
  return hit === null ? 'one-shot by the Arbiter of Divinity' : `one-shot by the Arbiter of Divinity's ${hit} (${ratio.toFixed(2)} of your max hit)`;
}
/** A rough clear speed in words: the record's `measures.clearSpeed`, or the D1 gate's word. */
const speedOf = (c) => (typeof c === 'string' ? c : typeof c?.speed === 'string' ? c.speed : 'not measured');
const clearWords = (c) => (speedOf(c) === 'not measured' ? 'clear speed not measured' : `clear speed ${speedOf(c)} (rough)`);
/** What the figures mean, said once above them (D-392). */
const FIGURES_MEAN = "Damage is PoB's damage per second for the main skill; effective HP is PoB's estimate of the damage it takes to kill you; clear speed is a rough estimate from the main skill's area.";
/** A rung's figures in words (D-392): damage, effective HP, the Arbiter on `b` and `n`, and the rough clear speed. */
function rungWords(r) {
  return [
    `${whole(r.dps)} damage per second`,
    `${whole(r.ehp)} effective HP`,
    ...(r.arbiter !== null && r.arbiter !== undefined ? [arbiterWords(r.arbiter)] : []),
    clearWords(r.clearSpeed),
  ].join(', ');
}

/** The verdict parts in words (D-392; gates.md): what each checks, and how it came out. */
const PART_WORDS = {
  compiled: { pass: 'PoB built it', fail: "PoB couldn't build it", unverified: "PoB's build of it wasn't checked" },
  v1: {
    pass: "it's legal at each stage's level (passive points, gem levels, item and attribute requirements)",
    fail: "something isn't legal at its stage's level (passive points, gem levels, item or attribute requirements)",
    unverified: "its levels and requirements weren't checked",
  },
  v2: { pass: "its PoB settings match what each stage has", fail: "a PoB setting doesn't match what its stage has", unverified: "its PoB settings weren't checked" },
  floor: {
    pass: 'every endgame rung meets the survival floor (capped resistances, and a max hit above each map hit)',
    fail: 'an endgame rung misses the survival floor (capped resistances, and a max hit above each map hit)',
    unverified: "the survival floor wasn't checked",
  },
  budget: { pass: "every rung's price total is known", unverified: "some prices aren't known, so not every rung's total is", fail: "the budget check failed" },
  rolledSkill: { pass: 'the named skill is its main damage', fail: "the named skill isn't its main damage", unverified: "whether the named skill is its main damage wasn't checked" },
};
const GATE_WHAT = { 'D1-gate': 'The endgame design', 'D2-gate': 'The whole plan, from level 1 to the endgame', R1b: "The card's skeleton build" };
/** A gate verdict in one plain sentence: what was checked and how each part came out. */
function verdictWords(stage, verdict) {
  if (!isObj(verdict)) return `${GATE_WHAT[stage] ?? stage}: no verdict was recorded.`;
  const said = Object.entries(verdict).map(([k, v]) => PART_WORDS[k]?.[v] ?? `${k} ${v}`);
  return `${GATE_WHAT[stage] ?? stage}: ${said.join('; ')}.`;
}

/** Each display ends its plain part with the invitation (D-389), then its codes, ids and paths (D-392). */
const INVITE = {
  brainstorm: 'Ask anything about these cards first. Then say in your own words which 1 to 3 to verify (by name or number), with any changes you want, or a new card from their ideas; or brainstorm more, or stop.',
  verification: 'Ask anything about these builds first. Then say in your own words which one to finalize, with any changes; or verify other cards, make a new one, brainstorm more, or stop.',
  design: 'Ask anything about this build first. Then accept it, ask for changes, go back to the verification gate to finalize another card, or stop.',
  final: 'Ask anything about the guide first. Then accept it, ask for changes, or say that you decline it.',
  escalation: 'Ask anything about this first. Then accept what failed, give guidance for one more try, go back to the verification gate, or stop.',
};
const reference = (items) => (items.length > 0 ? ['', 'For reference:', ...items.map((l) => (l.startsWith(' ') ? l : `- ${l}`))] : []);

function briefLine(log) {
  const brief = isObj(log.brief) ? Object.entries(log.brief).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : '';
  return `Brief: ${brief || 'none (surprise me)'}`;
}

/** One card's pitch lines (D-392): its five lines, then Unusual, a link not confirmed, and a gate's mark. */
function pitchLines(card, plain, deckLine) {
  const field = (k) => card.fields.get(k)?.value;
  const out = PITCH_LINES.map((k) => `   ${k}: ${text(field(k)) ? plain(field(k)) : 'not given'}`);
  if (text(field('Under-played (judgment)'))) out.push(`   Unusual: ${plain(field('Under-played (judgment)'))}`);
  if (text(field('Not confirmed'))) out.push(`   Not confirmed: ${plain(field('Not confirmed'))}`);
  for (const g of card.made) out.push(`   Made at the gate (visit ${g.visit}): ${plain(g.text)}`);
  for (const g of card.changed) out.push(`   Changed at the gate (visit ${g.visit}): ${plain(g.text)}`);
  if (deckLine?.parts.some((p) => /^can't be finalized yet/i.test(p))) out.push(`   ${plain(deckLine.parts.find((p) => /^can't be finalized yet/i.test(p))).replace(/^c/, 'C')}.`);
  return out;
}

function brainstormDisplay(dir, log) {
  const out = [briefLine(log), ''];
  const deckText = readText(dir, 'cards.md');
  if (deckText === null) return [...out, 'No cards.md in the run folder.'];
  const deck = parseDeck(deckText);
  const { cards, name, plain } = cardsOf(dir, deck);
  if (text(deck.share)) out.push(`What the cards share: ${plain(deck.share)}`);
  if (text(deck.differ)) out.push(`How they differ: ${plain(deck.differ)}`);
  out.push("Not confirmed in game: no card has been played yet; each rests on the game's text and PoB's model. A card says so where one of its key links isn't confirmed even by a lookup.", '');
  // Every dealt card not verified yet, numbered, its name and its pitch (D-392).
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  const dealt = deck.entries.filter((d) => d.round !== null && !verified.has(d.id));
  const ref = [];
  dealt.forEach((d, k) => {
    out.push(`${k + 1}. ${name(d.id)}`, ...pitchLines(cards.get(d.id) ?? parseCard(null), plain, d), '');
    ref.push(`${k + 1}. ${name(d.id)}: ${d.id}`);
  });
  if (dealt.length === 0) out.push('No dealt card is left to verify.', '');
  const short = lastStage(log, ['R1a-assemble'])?.shortReason;
  if (text(short)) out.push(`A short round: ${plain(short)}`, '');
  const notDealt = deck.entries.filter((d) => d.section === 'Not dealt');
  out.push('Not dealt:', ...(notDealt.length > 0 ? notDealt.map((d) => `- ${name(d.id)}: ${plain(d.parts.join('; ') || 'no reason given')}`) : ['None.']), '');
  out.push('Found, not used:', ...(deck.found.length > 0 ? deck.found.map((f) => `- ${plain(f.text)}`) : ['None.']), '');
  out.push(INVITE.brainstorm);
  if (notDealt.length > 0) ref.push(`Not dealt: ${notDealt.map((d) => `${name(d.id)}: ${d.id}`).join(', ')}`);
  ref.push(`Deck: ${path.join(dir, 'cards.md')}`);
  return [...out, ...reference(ref)];
}

/** The dossier's rows (D-355): `{id, cells}` by its columns. */
function dossierRows(textOrNull) {
  if (typeof textOrNull !== 'string') return [];
  const rows = textOrNull.split('\n').filter((l) => l.trim().startsWith('|')).map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  const head = rows[0] ?? [];
  return rows.slice(2).filter((r) => CARD.test(r[0] ?? '')).map((r) => ({ id: r[0], cell: (col) => r[head.indexOf(col)] ?? '' }));
}

/**
 * A card's skeleton figures (D-294, D-397): the main group's Count-scaled figure, its minion's `MinionTotalDPS` when
 * the group names a minion skill or its `skillOutputs` entry carries `Minion<Field>` fields, else `TotalDPS`; its
 * life and effective HP; and what PoB measured against. Null with no record.
 */
function skeletonFigures(dir, id) {
  const record = readJson(dir, `concepts/${id}/compile-record.json`);
  const plan = readJson(dir, `concepts/${id}/plan.json`);
  const st = objects(plan?.stages)[0];
  const rec = record?.stages?.[st?.id ?? skeletonStage(id)];
  if (!isObj(rec)) return null;
  const main = isObj(st?.skills?.main) ? st.skills.main : { group: 1, activeSkill: 1 };
  const key = `g${main.group}s${main.activeSkill}p${main.statSet ?? 1}`;
  const minion = objects(rec.minionSkills).some((m) => m.group === main.group) || Object.keys(rec.skillOutputs?.[key]?.fields ?? {}).some((f) => /^Minion[A-Z]/.test(f));
  const field = minion ? 'MinionTotalDPS' : 'TotalDPS';
  const counted = rec.countedSkillOutputs?.[key];
  const dps = counted?.fields?.[field] ?? rec.countedOutputs?.fields?.[field] ?? rec.skillOutputs?.[key]?.fields?.[field];
  const count = counted?.count ?? 1;
  const skill = rec.skillOutputs?.[key]?.skill ?? counted?.skill ?? 'the main skill';
  const boss = objects(st?.config?.scenario).find((c) => c.option === 'enemyIsBoss')?.value;
  return {
    dps, skill, minion, estimate: count > 1 || rec.computedWithCustomMods === true, life: rec.outputs?.Life, ehp: rec.outputs?.TotalEHP,
    against: boss === undefined || boss === 'None' ? 'map monsters' : `a boss (PoB's ${boss} setting)`, clear: rec.measures?.clearSpeed,
  };
}

/** A dossier status in words (D-392): works, failed: <why>, or can't be built yet: <why>; its file path left for reference. */
function statusWords(status, plain) {
  const s = String(status).replace(/;?\s*reports\/gates\/\S+/g, '').trim();
  if (/^viable\b/i.test(s)) return 'works';
  if (/^can't be finalized yet/i.test(s)) return plain(s.replace(/^can't be finalized yet/i, "can't be built yet"));
  return plain(s.replace(/^failed after (\d+) attempts?/i, (m, n) => `failed after ${n} ${n === '1' ? 'try' : 'tries'}`));
}

const OUTCOME_WORDS = { pass: 'passed', fail: 'failed', infeasible: "found it can't be built as designed", escalated: 'failed and was escalated to you' };

function verificationDisplay(dir, log) {
  const dossier = readText(dir, 'dossier.md');
  const { cards, name, plain } = cardsOf(dir);
  const out = [];
  const ref = [];
  const rows = dossierRows(dossier);
  if (dossier === null) out.push('No dossier.md in the run folder.', '');
  rows.forEach((r, k) => {
    const card = cards.get(r.id) ?? parseCard(null);
    const field = (f) => card.fields.get(f)?.value;
    out.push(`${k + 1}. ${name(r.id)}: ${statusWords(r.cell('Status'), plain)}.`);
    if (text(field('Why pick it'))) out.push(`   Why pick it: ${plain(field('Why pick it'))}`);
    const fig = /^viable\b/i.test(r.cell('Status')) ? skeletonFigures(dir, r.id) : null;
    if (fig) {
      const how = fig.estimate ? 'an estimate: a Count above 1 or a custom modifier carries it' : 'modelled in PoB';
      out.push(`   Damage: ${whole(fig.dps)} per second from ${fig.minion ? `${fig.skill}'s minions` : fig.skill}, against ${fig.against} (${how}).`);
      out.push(`   Toughness: ${whole(fig.life)} life and ${whole(fig.ehp)} effective HP (PoB's estimate of the damage it takes to kill you).`);
      if (fig.clear) out.push(`   Clear speed: ${speedOf(fig.clear)} (a rough estimate from the main skill's area).`);
    }
    // §5's rough clear speed: the record's measure when it has one; a skeleton has none (only a stage with a variant is
    // measured), so a verified card's "How it clears" stands in for it, marked as the estimate it is.
    const unmeasured = fig !== null && !fig.clear;
    if (text(field('How it clears'))) out.push(`   How it clears: ${plain(field('How it clears'))}${unmeasured ? ' (an estimate; measured at the design)' : ''}`);
    const prices = r.cell('Key prices');
    if (text(prices) && !/^[—-]+$/.test(prices)) out.push(`   Key prices: ${plain(prices)}${/^none\b/i.test(r.cell('League')) || /^[—-]*$/.test(r.cell('League')) ? '' : ` (league: ${r.cell('League')})`}.`);
    if (text(field('The catch'))) out.push(`   The catch: ${plain(field('The catch'))}`);
    const risk = r.cell('Main risk');
    if (text(risk) && !/^[—-]+$/.test(risk)) out.push(`   Found in verification: ${plain(risk)}`);
    for (const g of card.made) out.push(`   Made at the gate (visit ${g.visit}): ${plain(g.text)}`);
    for (const g of card.changed) out.push(`   Changed at the gate (visit ${g.visit}): ${plain(g.text)}`);
    out.push('');
    ref.push(`${k + 1}. ${name(r.id)}: ${r.id}`);
  });
  const lastR1b = new Map();
  for (const s of stagesOf(log)) if (s.stage === 'R1b' && s.outcome !== 'missing') lastR1b.set(s.concept, s);
  for (const s of lastR1b.values()) if (s.outcome === 'fail') ref.push(`${name(s.concept)} (${s.concept}) failed: ${verdictFile(s)}`);
  // Back from a design (infeasible, an escalation, the design gate's verification): that card's evidence.
  const back = lastStage(log, ['D1-gate', 'D2-gate']);
  if (back) {
    out.push(`Back from the design of ${name(back.concept)}: its last check ${OUTCOME_WORDS[back.outcome] ?? back.outcome}.`, '');
    ref.push(`Last design verdict, ${back.concept} (${back.outcome}): ${verdictFile(back)}`);
  }
  out.push(INVITE.verification);
  ref.push(`Dossier: ${path.join(dir, 'dossier.md')}`);
  return [...out, ...reference(ref)];
}

/** A plan's endgame stage label in words: "Entering maps (level 65)". */
function rungLabel(plan, id) {
  const st = objects(plan?.stages).find((s) => s.id === id);
  if (!st) return `Stage ${id}`;
  return `${RUNG_LABEL[st.variant] ?? st.loadoutName ?? `Stage ${id}`}${isNum(st.level) ? ` (level ${st.level})` : ''}`;
}

function designDisplay(dir, log) {
  const s = lastStage(log, ['D1-gate']);
  if (!s) return ['No D1 gate in the run log.'];
  const file = verdictFile(s);
  const gate = readJson(dir, file);
  if (!isObj(gate?.design)) return [`${file} has no design field.`];
  const plan = readJson(dir, 'plan.json');
  const { name } = cardsOf(dir);
  const out = [`The endgame build for ${name(s.concept)}, rung by rung, as its last design check measured it. ${FIGURES_MEAN}`, ''];
  for (const r of objects(gate.design.rungs)) {
    out.push(`${rungLabel(plan, r.stage)}:`);
    out.push(`- Damage: ${whole(r.dps)} per second.`);
    out.push(`- Effective HP: ${whole(r.ehp)}.`);
    if (r.arbiter !== null && r.arbiter !== undefined) out.push(`- The Arbiter of Divinity: ${arbiterWords(r.arbiter).replace(/^survives the Arbiter of Divinity's hits/, 'survives its hits').replace(/^one-shot by the Arbiter of Divinity's /, 'one-shot by its ')}.`);
    out.push(`- Clear speed: ${speedOf(r.clearSpeed)} (rough).`);
    for (const [k, label] of [['anoint', 'Anoint'], ['gear', 'Gear'], ['gems', 'Gems'], ['tree', 'Passive tree']]) if (text(r[k])) out.push(`- ${label}: ${r[k]}`);
    out.push('');
  }
  // An estimate the gate wrote for one rung (`b: …`) names the rung in words.
  const ids = new Set(objects(gate.design.rungs).map((r) => r.stage));
  const estimates = (Array.isArray(gate.design.estimates) ? gate.design.estimates.filter(text) : []).map((e) => e.replace(/^(\w+):\s*/, (m, id) => (ids.has(id) ? `${rungLabel(plan, id)}: ` : m)));
  if (estimates.length > 0) out.push('Still estimates:', ...estimates.map((e) => `- ${e}`), '');
  out.push(verdictWords('D1-gate', gate.verdict), '', INVITE.design);
  const rungs = objects(gate.design.rungs).map((r) => `${rungLabel(plan, r.stage)}: ${r.stage}`);
  return [...out, ...reference([`Verdict: ${parts(gate.verdict)}`, `Verdict file: ${file}`, ...(rungs.length > 0 ? [`Rungs: ${rungs.join(', ')}`] : [])])];
}

async function finalDisplay(dir, log) {
  const { name } = cardsOf(dir);
  const d1 = lastStage(log, ['D1-gate']);
  const d2 = lastStage(log, ['D2-gate']);
  const d1gate = d1 ? readJson(dir, verdictFile(d1)) : null;
  const d2gate = d2 ? readJson(dir, verdictFile(d2)) : null;
  const card = d2?.concept ?? d1?.concept;
  const out = [
    `The guide${card ? ` for ${name(card)}` : ''}: ${path.join(dir, 'guide.md')}`,
    `Its audit, how each number was checked: ${path.join(dir, 'audit.md')}`,
    `Your PoB file: ${d2gate?.finalCompile?.pobFile ?? "none: the final compile didn't run"}`,
    '',
  ];
  let checker;
  try {
    const { checkRun } = await import('./check-run.mjs');
    checker = await checkRun(dir);
  } catch (e) {
    checker = e;
  }
  const v4 = lastStage(log, ['V4', 'V4-recheck']);
  out.push('What was checked:');
  for (const [s, g] of [[d1, d1gate], [d2, d2gate]]) if (s) out.push(`- ${verdictWords(s.stage, g?.verdict)}`);
  if (v4) out.push(`- The guide's claims, against their sources: ${v4.outcome === 'pass' ? 'every one holds' : "some are still open; they're the known issues below"}.`);
  out.push(`- The run checker: ${Array.isArray(checker) ? (checker.length === 0 ? 'it found no problem' : `it found ${checker.length} problem(s), listed under For reference`) : "it didn't run"}.`, '');
  // D-369: each endgame rung's figures from the final record, and the design gate's where they moved since.
  const plan = readJson(dir, 'plan.json');
  const record = readJson(dir, 'compile-record.json');
  const atDesign = new Map(objects(d1gate?.design?.rungs).map((r) => [r.stage, r]));
  out.push(`The endgame, from the final build. ${FIGURES_MEAN}`);
  const rungIds = [];
  for (const variant of RUNGS) {
    const st = objects(plan?.stages).find((x) => x.variant === variant);
    if (!st) continue;
    rungIds.push(`${rungLabel(plan, st.id)}: ${st.id}`);
    const m = record?.stages?.[st.id]?.measures ?? {};
    const now = rungWords({ dps: m.dps, ehp: m.ehp, arbiter: variant === 'entering-maps' ? null : (m.arbiter ?? 'not measured'), clearSpeed: m.clearSpeed });
    out.push(`- ${rungLabel(plan, st.id)}: ${now}.`);
    const then = atDesign.get(st.id);
    if (then) {
      const was = rungWords({ ...then, arbiter: variant === 'entering-maps' ? null : then.arbiter });
      if (was !== now) out.push(`  At the design gate: ${was}.`);
    }
  }
  // D-371, D-374: each rung's total range at its price day against its target, and its over-target slots, from the
  // D1 gate's last verdict file, in the words of the guide's Checks (render-audit.mjs's budget lines).
  const budget = [];
  if (isObj(d1gate)) {
    const { budgetLines } = await import('./render-audit.mjs');
    for (const variant of RUNGS) {
      const st = objects(plan?.stages).find((x) => x.variant === variant);
      if (!st) continue;
      const [first, ...rest] = budgetLines(st, plan, d1gate);
      budget.push(`- ${rungLabel(plan, st.id)}: ${first.replace(/^- /, '')}`, ...rest.map((l) => `  ${l.trim()}`));
    }
  }
  if (budget.length > 0) out.push('', 'The budget, from the last design check:', ...budget);
  // A fallback (`<id>-fallback`) counts in no total (D-371), so its price is never a D-164 reason.
  const unknown = objects(plan?.prices).some((p) => p.status === 'unavailable' && !String(p.id).endsWith('-fallback'));
  if (unknown) out.push("Some prices are unavailable, so the total of each rung they price isn't known.");
  if (log.mode === 'offline') out.push('The guide is from an offline run: no price was checked.');
  const guide = readText(dir, 'guide.md');
  const lines = guide === null ? [] : guide.split('\n');
  const at = lines.indexOf('### Known issues');
  const end = lines.findIndex((l, i) => i > at && /^#{1,3} /.test(l));
  const issues = at < 0 ? [] : lines.slice(at + 1, end < 0 ? undefined : end).filter((l) => l.trim() !== '');
  out.push('', "What's still open, the guide's known issues:", ...(issues.length > 0 ? issues : ['None.']), '', INVITE.final);
  const ref = [];
  for (const [s, g] of [[d1, d1gate], [d2, d2gate]]) if (s) ref.push(`${s.stage}: ${parts(g?.verdict)} (${verdictFile(s)})`);
  if (rungIds.length > 0) ref.push(`Rungs: ${rungIds.join(', ')}`);
  if (unknown) ref.push('Unknown totals: D-164');
  if (Array.isArray(checker)) ref.push(checker.length === 0 ? 'Run checker: ok' : `Run checker: ${checker.length} violation(s)`, ...checker.map((v) => `  [${v.rule}] ${v.message}`));
  else ref.push(`Run checker: didn't run (${checker?.message ?? checker})`);
  return [...out, ...reference(ref)];
}

function escalationDisplay(dir, log) {
  const s = stagesOf(log).filter((x) => x.outcome === 'escalated').pop();
  if (!s) return ['No escalated gate attempt in the run log.'];
  const { name, plain } = cardsOf(dir);
  const file = verdictFile(s);
  const gate = readJson(dir, file);
  const attempts = stagesOf(log).filter((x) => x.stage === s.stage && x.concept === s.concept);
  const failed = attempts.filter((a) => a.outcome !== 'pass').length;
  const failing = isObj(gate?.verdict) ? Object.entries(gate.verdict).filter(([k, v]) => v === 'fail' || (v === 'unverified' && k !== 'budget')).map(([k]) => k) : [];
  const findings = objects(gate?.findings).filter((f) => failing.includes(f.part) && !['chaos-exception', 'over-target'].includes(f.code));
  const why = failing.length > 0 ? failing.map((k) => PART_WORDS[k]?.fail ?? `${k} failed`).join('; ') : 'its verdict file names no failing part';
  const first = findings[0]?.message;
  const what = GATE_WHAT[s.stage] ?? s.stage;
  return [
    `${what} for ${name(s.concept)} failed ${failed} ${failed === 1 ? 'time' : 'times'}, so the run stops to ask you. What failed: ${why}${text(first) ? `: ${plain(first)}` : ''}${findings.length > 1 ? ` (and ${findings.length - 1} more, under For reference)` : ''}.`,
    '',
    INVITE.escalation,
    ...reference([
      `${s.stage}, ${s.concept}: attempts ${attempts.map((a) => `${a.attempt} ${a.outcome}`).join(', ')}`,
      `Verdict: ${parts(gate?.verdict)}`,
      ...objects(gate?.findings).map((f) => `  ${f.part ?? '—'} ${f.code ?? '—'}: ${f.message ?? ''}`),
      `Verdict file: ${file}`,
    ]),
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
  const kinds = ['init', 'stage', 'checkpoint', 'escalation', 'set', 'display', 'test-config'];
  if (args.length !== 3 || !kinds.includes(args[1])) {
    process.stderr.write(`usage: node run-log.mjs <runFolder> <${kinds.slice(0, -2).join('|')}> '<json>' | -  (- reads the JSON from stdin), <runFolder> display <${DISPLAYED.join('|')}>, or <runFolder> test-config <path>\n`);
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
  if (args[1] === 'test-config') {
    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(args[2], 'utf8'));
    } catch (e) {
      process.stderr.write(`run-log: test config refused: ${args[2]} can't be read as JSON (${e.code ?? e.message})\n`);
      return 1;
    }
    const problems = testConfigProblems(cfg);
    if (problems.length > 0) {
      process.stderr.write(`run-log: test config refused: ${problems.join('; ')}\n`);
      return 1;
    }
    process.stdout.write(`run-log: test config ${args[2]} is well formed\n`);
    return 0;
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

// No top-level await: the final display imports check-run.mjs, which imports this file, and a module still awaiting
// its own main would never finish loading for it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
