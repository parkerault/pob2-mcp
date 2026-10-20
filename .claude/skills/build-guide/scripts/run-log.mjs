#!/usr/bin/env node
// The build-guide run log's writer (D-356): the runner writes run-log.json only through it, never with Write.
//
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> init '{"slug", "brief", "mode", "testConfig", "noNinja"[, "status"]}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> stage '{"stage", "concept"?, "attempt", "outcome", …}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> checkpoint '{"checkpoint", "concept"?, "visit", "answer", "answeredBy", "rule"?, "questions"?, "changes"?, "newCards"?, "note"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> escalation '{"stage", "concept", "verdict", "choice", "guidance"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> build '{"id", "roll"?, "status"?, "guide"?, "pobFile"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> set '{"status"?, "dossier"?, "faults"?}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> resume '{"noNinja"}'
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> migrate
//   node .claude/skills/build-guide/scripts/run-log.mjs <runFolder> display <brainstorm|verification|design|final|escalation> [--build <card id>]
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
// `init` writes the first log (schema 4, `runFolder` the folder given, empty lists) and never overwrites one; `stage`,
// `checkpoint` and `escalation` append one entry to `stages[]`, `checkpoints[]` or `escalations[]`; `set` replaces
// those top-level fields. Each entry has exactly the fields of ../references/run-log.md's entry form, and a wrong one is
// refused with nothing written. A schema-3 log takes schema 3's entries until `migrate` rewrites it. The run checker
// checks the whole log and its flow.
//
// Amendment 9 (WU-94; D-411…D-415, D-421), schema 4:
//  - the log: `{schemaVersion: 4, runFolder, slug, brief, status, mode, testConfig, noNinja, pinCommit, digest, dossier,
//    builds, stages, checkpoints, displays, escalations, faults, resumes}`; no run-level `roll` or `outputs`. `init`
//    takes `noNinja` (true or false, --no-ninja), and records the pin's commit from pob-pin.json and the newest league
//    digest's file name (data/league/<name>.md, newest by the fetch date on its third line), null when there is none;
//  - `builds[]`, one per finalized card in finalize order, `{id, roll, status, folder, guide, pobFile}`: `build` adds one
//    `{"id", "roll", "status": "queued"}` (its folder `builds/<id>`), then changes its `status` (queued, designing,
//    writing, completed, file-only, not-accepted, dropped, stopped, escalated), its `guide` (null, endgame or full) or
//    its `pobFile`; a card with a build is never finalized again;
//  - `resume` appends `{date, pinCommit, digest, noNinja, lengths: {stages, checkpoints, escalations, displays}}`, the
//    session's --no-ninja and each list's length at the resume, and sets `status` running;
//  - `migrate` rewrites a schema-3 log: its finalized card as `builds[0]` with `folder: "."`, its design and final
//    checkpoints given `concept` from the D1 gate entry before each, a final-gate decline's note prefixed `decline:`,
//    `noNinja`, `pinCommit` and `digest` null;
//  - the stages D1-tree (`done`), F1 (`pass`, `fail`, `escalated`) and V4-campaign (`pass`, `fail`); any step may be
//    `refused` (D-421); F1 escalates (`reports/gates/F1-<id>-a<n>.json`);
//  - a design or final checkpoint names its build, `concept`; the verification gate's answers add `pick:<id>[,<id>…]`
//    (1–3 cards) and, after a resume, `guide:<id>` (a file-only build), `campaign:<id>` (completed or file-only) and
//    `design:<id>` (stopped or dropped); the design gate's `accept:file`; the final gate's `accept`,
//    `accept:verification`, `campaign`, `revise:<text>` and `decline:<note>`, its `stop` the default only;
//  - `display design --build <id>` and `display final --build <id>` show that build (the design display's tree lines
//    from the D1 gate verdict's `design.rungs[].tree`, `{travel, points, bestSwap, needs}`; the final display's travel
//    beside each rung's figures); the verification display lists every build with its status, and says when the pin
//    or the digest changed since the run last ran.
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
// Amendment 8 (WU-89): the rival's step `RV` (D-408), `done` when it wrote its card `cards/r<k>-x-<n>.md` and
// `none-found` with `tried`, what it tried, when it found no faster structure; the card id letter `x`. The brainstorm
// display adds the obvious card's `Obvious build:` line (D-403) and a card's `waits on the pin` entry (D-400); the
// verification display leads each card with its skeleton's measured clear speed and movement speed, then its Bosses
// line (D-407), marks the rival, and shows the structure check's `A stronger structure?` line (D-406); the design
// display leads each rung with its clear speed and movement speed, then the Arbiter check. A clear skill PoB gives no
// area reads `<speed> (PoB gives no area)`. The formats: docs/build-guide/studies/2026-10-18-wu89-formats.md.
//
// `test-config <path>` (D-394) checks a test config's shape and writes nothing: each gate's answers are strings, or
// objects `{ask, answer, changes, newCards, note}` scripting an interview. What needs the deck (a new card's `from`
// and its name) is checked when the gate's checkpoint is written.
// Exit 0: written, the display printed (stdout), or the test config well formed. Exit 1: refused (stderr). Exit 2:
// usage error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A card id (D-319): `r<round>-<letter>-<n>`, the letters a to c a brainstorm round's researchers', g a card made at a
 * gate (D-391), x the rival's (D-408).
 */
export const CARD_ID = 'r[1-9]\\d*-[a-cgx]-[1-9]\\d*';
const CARD = new RegExp(`^${CARD_ID}$`);
/** A card made at a gate (D-391): `r<k>-g-<n>`. */
const GATE_CARD = /^r([1-9]\d*)-g-([1-9]\d*)$/;
/** The rival's card (D-408): `r<k>-x-<n>`, k the latest brainstorm round when its RV step ran, n counting the run's rivals in it. */
export const RIVAL_CARD = /^r([1-9]\d*)-x-([1-9]\d*)$/;
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
  // D-408: the rival writes its card (`done`), or finds no faster structure (`none-found`, with what it `tried`).
  RV: ['done', 'none-found'],
  // Amendment 9 (schema 4): D1's tree step (D-418), the endgame-only build's final compile (D-413) and V4's campaign
  // pass (D-415).
  'D1-tree': ['done'],
  F1: ['pass', 'fail', 'escalated'],
  'V4-campaign': ['pass', 'fail'],
};
/** The stages schema 4 adds (amendment 9); a schema-3 log has none. */
const SCHEMA4_STAGES = ['D1-tree', 'F1', 'V4-campaign'];
const NO_CONCEPT = ['R1a', 'R1a-assemble', 'R1b-assemble', 'Q', 'RV'];
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
/**
 * Schema 4's answers (amendment 9; D-411, D-415): the verification gate finalizes 1–3 cards (`pick:<id>[,<id>…]`) and,
 * after a resume, takes `guide:<id>`, `campaign:<id>` and `design:<id>`; the design gate adds `accept:file`; the final
 * gate's answers are `accept`, `accept:verification`, `campaign`, `revise:<text>` and `decline:<note>`, its `stop` the
 * default only.
 */
const ANSWERS4 = {
  ...ANSWERS,
  verification: new RegExp(`^(?:pick:${IDS}|verify:(?:${IDS})?|(?:guide|campaign|design):${CARD_ID}|more|stop)$`),
  design: /^(?:accept|accept:file|revise:.+|verification|stop)$/s,
  final: /^(?:accept|accept:verification|campaign|revise:.+|decline:.+|stop)$/s,
};
/** The answers a resume offers at the verification gate (D-415), each naming one build. */
export const RESUME_ANSWER = new RegExp(`^(guide|campaign|design):(${CARD_ID})$`);
/**
 * A test config's answers per gate (offline-and-test.md, D-323, D-362): the runner resolves first-n and first-viable.
 * Schema 4's forms are accepted too (amendment 9): a verification pick of 1–3 cards, the design gate's `accept:file`,
 * and the final gate's `accept:verification`, `campaign` and `decline:<note>` (`not-accept` resolves to a decline).
 */
const CONFIG_ANSWERS = {
  brainstorm: new RegExp(`^(?:pick:(?:${IDS})?|first-n:[1-3]|more|stop)$`),
  verification: new RegExp(`^(?:first-viable|pick:${IDS}|verify:(?:${IDS})?|more|stop)$`),
  design: /^(?:accept|accept:file|revise:.+|verification|stop)$/s,
  final: /^(?:accept|accept:verification|campaign|not-accept|revise:.+|decline:.+)$/s,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
const STATUSES = ['running', 'completed', 'not-accepted', 'stopped', 'escalated'];
/** D-412: a build's status, from its finalize to its end. */
export const BUILD_STATUSES = ['queued', 'designing', 'writing', 'completed', 'file-only', 'not-accepted', 'dropped', 'stopped', 'escalated'];
/** D-412, D-414: a build's guide, as its plan decides: none yet, the endgame guide, or the full guide. */
const GUIDE_KINDS = [null, 'endgame', 'full'];
/** Each kind's fields, in the order run-log.md writes them. */
const FIELDS = {
  stage: ['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes', 'probes', 'shortReason', 'tried'],
  checkpoint: ['checkpoint', 'visit', 'answer', 'answeredBy', 'rule', 'questions', 'changes', 'newCards', 'note'],
  escalation: ['stage', 'concept', 'verdict', 'choice', 'guidance'],
  set: ['status', 'roll', 'outputs', 'faults'],
  init: ['slug', 'brief', 'mode', 'testConfig', 'status'],
};
/**
 * Schema 4's fields (amendment 9; D-412, D-415): a design or final checkpoint names its build (`concept`); `set` drops
 * `roll` and `outputs` for the run-wide `dossier`; `init` records `noNinja`; `build` adds a finalized card's build or
 * updates its status, guide or PoB file; `resume` gives the session's `noNinja`, and the script adds the rest.
 */
const FIELDS4 = {
  ...FIELDS,
  checkpoint: ['checkpoint', 'concept', 'visit', 'answer', 'answeredBy', 'rule', 'questions', 'changes', 'newCards', 'note'],
  set: ['status', 'dossier', 'faults'],
  init: ['slug', 'brief', 'mode', 'testConfig', 'noNinja', 'status'],
  build: ['id', 'roll', 'status', 'guide', 'pobFile'],
  resume: ['noNinja'],
};
/** A build entry's fields in builds[], in order (D-412). */
const BUILD_FIELDS = ['id', 'roll', 'status', 'folder', 'guide', 'pobFile'];
/** The repository root (scripts → build-guide → skills → .claude → root): `pob-pin.json` and `data/league/`. */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
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

/**
 * The problems with an entry of a kind: its fields, as run-log.md's entry form gives them, in the log's schema (3, or 4
 * from amendment 9).
 */
export function entryProblems(kind, e, schema = 3) {
  if (!isObj(e)) return ['the entry is a JSON object'];
  const v4 = schema === 4;
  const allowed = (v4 ? FIELDS4 : FIELDS)[kind] ?? [];
  const bad = Object.keys(e).filter((k) => !allowed.includes(k)).map((k) => `"${k}" isn't a field of a ${kind} entry (${allowed.join(', ')})`);
  if (kind === 'stage') {
    const stages = Object.keys(OUTCOMES).filter((s) => v4 || !SCHEMA4_STAGES.includes(s));
    const outcomes = stages.includes(e.stage) ? OUTCOMES[e.stage] : undefined;
    if (!outcomes) return [...bad, `stage ${show(e.stage)} isn't one of ${stages.join(', ')}${SCHEMA4_STAGES.includes(e.stage) ? ` (${e.stage} is schema 4's: migrate the log first)` : ''}`];
    if (NO_CONCEPT.includes(e.stage) ? e.concept !== undefined : !CARD.test(String(e.concept))) bad.push(NO_CONCEPT.includes(e.stage) ? `a ${e.stage} entry has no concept` : `concept ${show(e.concept)} isn't a card id r<round>-<letter>-<n>`);
    if (!isInt(e.attempt, 1)) bad.push(`attempt ${show(e.attempt)} isn't a whole number from 1`);
    // D-421: in schema 4 any step the permission system refused is logged `refused`, then re-run alone, uncounted.
    const any = v4 ? ['missing', 'refused'] : ['missing'];
    if (![...outcomes, ...any].includes(e.outcome)) bad.push(`a ${e.stage} entry's outcome is ${[...outcomes, 'missing'].join(', ')}, not ${show(e.outcome)}`);
    if (e.priceOutcomes !== undefined) {
      if (!PRICING.includes(e.stage)) bad.push(`priceOutcomes is only on ${PRICING.join(', ')}`);
      else if (!isObj(e.priceOutcomes) || Object.entries(e.priceOutcomes).some(([k, v]) => !['ok', 'error', ...TRADE_KINDS].includes(k) || !isInt(v, 0))) bad.push('priceOutcomes counts calls by outcome: ok, error or a [trade:<kind>] kind, each a whole number');
    }
    if (e.stage === 'R1b' ? !isInt(e.probes, 0) : e.probes !== undefined) bad.push(e.stage === 'R1b' ? 'an R1b entry has probes, the probe variants it ran (0 when none)' : 'probes is only on R1b');
    if (e.stage === 'R1a-assemble' ? e.shortReason !== undefined && !text(e.shortReason) : e.shortReason !== undefined) bad.push('shortReason is only on R1a-assemble, a non-empty text');
    // D-408: a rival that found no faster structure says what it tried.
    if (e.stage === 'RV' && e.outcome === 'none-found' ? !text(e.tried) : e.tried !== undefined) bad.push('tried is on an RV entry whose outcome is none-found, and only there: what the rival tried, a non-empty text (D-408)');
  } else if (kind === 'checkpoint') {
    const form = (v4 ? ANSWERS4 : ANSWERS)[e.checkpoint];
    if (!form) return [...bad, `checkpoint ${show(e.checkpoint)} isn't one of ${Object.keys(ANSWERS).join(', ')}`];
    if (!isInt(e.visit, 1)) bad.push(`visit ${show(e.visit)} isn't a whole number from 1`);
    if (typeof e.answer !== 'string' || !form.test(e.answer)) bad.push(`${show(e.answer)} isn't an answer of the ${e.checkpoint} checkpoint`);
    if (!['user', 'pre-supplied', 'default'].includes(e.answeredBy)) bad.push('answeredBy is user, pre-supplied or default');
    if (e.answeredBy === 'user' ? e.rule !== undefined : !text(e.rule)) bad.push(e.answeredBy === 'user' ? "a user's answer has no rule" : 'a pre-supplied or default answer has its rule');
    if (e.answeredBy === 'default' && e.answer !== 'stop') bad.push('a default answer is stop');
    if (v4) {
      // D-412: a design or final checkpoint names its build, the card id; no other checkpoint does.
      const per = ['design', 'final'].includes(e.checkpoint);
      if (per ? !CARD.test(String(e.concept)) : e.concept !== undefined) bad.push(per ? `a ${e.checkpoint} checkpoint names its build: concept, the card id r<round>-<letter>-<n>, not ${show(e.concept)} (D-412)` : `concept is only on a design or final checkpoint (D-412)`);
      // D-411: the final gate's stop is the default only; a user who declines answers decline:<note>.
      if (e.checkpoint === 'final' && e.answer === 'stop' && e.answeredBy !== 'default') bad.push("the final gate's stop is the default answer only; a user who declines the guide answers decline:<note> (D-411)");
    }
    if (e.questions !== undefined) {
      if (!DISPLAYED.includes(e.checkpoint)) bad.push("questions is only on a gate's or an escalation's answer; the unsaved-build question is a fixed question (D-389)");
      else if (!isInt(e.questions, 0)) bad.push(`questions ${show(e.questions)} isn't a whole number from 0, how many questions the user asked at the visit (D-389)`);
      else if (e.answeredBy === 'default' && e.questions > 0) bad.push('a default answer has no questions: nobody asked any');
    }
    if (typeof e.answer === 'string') bad.push(...choiceProblems(e.checkpoint, e, newCardProblems));
  } else if (kind === 'escalation') {
    // D-413: in schema 4 F1, the endgame-only build's final compile, escalates too.
    const gates = v4 ? ['D1-gate', 'D2-gate', 'F1'] : ['D1-gate', 'D2-gate'];
    if (!gates.includes(e.stage)) bad.push(`stage is ${gates.slice(0, -1).join(', ')} or ${gates[gates.length - 1]}`);
    if (!CARD.test(String(e.concept))) bad.push(`concept ${show(e.concept)} isn't a card id`);
    if (!new RegExp(`^reports/gates/(D[12]-gate|F1)-(${CARD_ID})-a[1-9]\\d*\\.json$`).test(String(e.verdict)) || !String(e.verdict).startsWith(`reports/gates/${e.stage}-${e.concept}-a`)) bad.push("verdict is the escalated attempt's file, reports/gates/<stage>-<concept>-a<attempt>.json");
    if (!['accept', 'retry', 'verification', 'stop'].includes(e.choice)) bad.push('choice is accept, retry, verification or stop');
    if (e.choice === 'retry' ? !text(e.guidance) : e.guidance !== undefined) bad.push('guidance goes with retry, and only with it');
  } else if (kind === 'set') {
    if (e.status !== undefined && !STATUSES.includes(e.status)) bad.push(`status is ${STATUSES.join(', ')}`);
    if (e.roll !== undefined && e.roll !== null && !isRoll(e.roll)) bad.push('roll is null or {className, ascendancy, skill}');
    if (e.outputs !== undefined && !(isObj(e.outputs) && Object.keys(e.outputs).every((k) => OUTPUTS.includes(k)) && OUTPUTS.every((k) => e.outputs[k] === null || text(e.outputs[k])))) bad.push(`outputs is {${OUTPUTS.join(', ')}}, each a path or null`);
    if (e.faults !== undefined && !(Array.isArray(e.faults) && e.faults.every((f) => isObj(f) && text(f.id) && isObj(f.target) && isInt(f.applied, 0) && typeof f.observed === 'string'))) bad.push('faults is a list of {id, target, applied, observed}');
    // D-412: the dossier is a run-wide field in schema 4, its path in the run folder.
    if (e.dossier !== undefined && e.dossier !== null && !text(e.dossier)) bad.push('dossier is the dossier\'s path in the run folder, or null');
  } else if (kind === 'init') {
    if (!text(e.slug)) bad.push('slug is the run folder\'s slug');
    if (!isObj(e.brief)) bad.push('brief is the parsed brief, {} for an empty one');
    if (!['offline', 'online'].includes(e.mode)) bad.push('mode is offline or online');
    if (!['none', 'accepted', 'refused'].includes(e.testConfig)) bad.push('testConfig is none, accepted or refused');
    if (e.status !== undefined && !['running', 'stopped'].includes(e.status)) bad.push('a first write\'s status is running, or stopped for a refused test config');
    // D-412, D-420: the run's --no-ninja, which every pricing step reads from the log.
    if (v4 && typeof e.noNinja !== 'boolean') bad.push('noNinja is true or false: whether the run prices without poe.ninja (--no-ninja, D-412)');
  } else if (kind === 'build') {
    // D-412: a finalized card's build, added queued with its card's identity; later writes change its status, its
    // guide (as the plan decides, D-414) or its PoB file (the final compile's record path).
    if (!CARD.test(String(e.id))) bad.push(`id ${show(e.id)} isn't a card id r<round>-<letter>-<n>`);
    if (e.roll !== undefined && !isRoll(e.roll)) bad.push("roll is the card's identity {className, ascendancy, skill} (D-286)");
    if (e.status !== undefined && !BUILD_STATUSES.includes(e.status)) bad.push(`status is ${BUILD_STATUSES.join(', ')}`);
    if (e.guide !== undefined && !GUIDE_KINDS.includes(e.guide)) bad.push('guide is null, endgame or full (D-414)');
    if (e.pobFile !== undefined && e.pobFile !== null && !text(e.pobFile)) bad.push("pobFile is the final compile's PoB file path, or null");
    if (Object.keys(e).length === 1 && e.id !== undefined) bad.push('a build entry changes its roll, status, guide or pobFile');
  } else if (kind === 'resume') {
    if (typeof e.noNinja !== 'boolean') bad.push("noNinja is true or false: whether this session prices without poe.ninja (--no-ninja, D-415)");
  }
  return bad;
}

/** A card's identity (D-286): `{className, ascendancy, skill}`, each non-empty text. */
const isRoll = (r) => isObj(r) && ['className', 'ascendancy', 'skill'].every((k) => text(r[k])) && Object.keys(r).length === 3;

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

/**
 * Applies one write to the run folder's log. Returns what it did, or throws an Error saying why not. `init` writes a
 * schema-4 log (amendment 9, D-412); the other writes append in the log's own schema, so a schema-3 log keeps its form
 * until `migrate` rewrites it, and `build` and `resume` are schema 4's.
 */
export function writeLog(runFolder, kind, entry) {
  const file = path.join(runFolder, 'run-log.json');
  const existing = kind === 'init' ? null : readLog(file);
  const schema = existing?.schemaVersion ?? 4;
  if (schema !== 4 && ['build', 'resume'].includes(kind)) throw new Error(`${kind} entry refused: run-log.json is a schema-3 log; ${kind} is schema 4's (amendment 9): run run-log.mjs <runFolder> migrate first`);
  const problems = entryProblems(kind, entry, schema);
  if (problems.length > 0) throw new Error(`${kind} entry refused: ${problems.join('; ')}`);
  let log;
  if (kind === 'init') {
    if (fs.existsSync(file)) throw new Error('run-log.json exists; init writes the first log only');
    log = {
      schemaVersion: 4, runFolder: path.resolve(runFolder), slug: entry.slug, brief: entry.brief, status: entry.status ?? 'running',
      mode: entry.mode, testConfig: entry.testConfig, noNinja: entry.noNinja, pinCommit: pinCommit(), digest: newestDigest(),
      dossier: null, builds: [], stages: [], checkpoints: [], displays: [], escalations: [], faults: [], resumes: [],
    };
  } else {
    log = existing;
    const expected = (Array.isArray(log.checkpoints) ? log.checkpoints.filter((c) => isObj(c) && c.checkpoint === entry.checkpoint).length : 0) + 1;
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && entry.visit !== expected) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s next visit is ${expected}, not ${entry.visit}`);
    }
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && !(Array.isArray(log.displays) && log.displays.some((d) => isObj(d) && d.checkpoint === entry.checkpoint && d.visit === entry.visit))) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s visit ${entry.visit} printed no display; run run-log.mjs <runFolder> display ${entry.checkpoint} first and print its output (D-367)`);
    }
    if (kind === 'checkpoint') {
      const against = [...newCardsAgainstRun(runFolder, log, entry), ...(schema === 4 ? buildsAgainstRun(log, entry) : [])];
      if (against.length > 0) throw new Error(`checkpoint entry refused: ${against.join('; ')}`);
    }
    const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
    const fields = (schema === 4 ? FIELDS4 : FIELDS)[kind];
    if (list) {
      if (!Array.isArray(log[list])) log[list] = [];
      log[list].push(Object.fromEntries(fields.filter((k) => entry[k] !== undefined).map((k) => [k, entry[k]])));
    } else if (kind === 'build') {
      saveLog(file, upsertBuild(log, entry));
      return `builds[${log.builds.findIndex((b) => b.id === entry.id)}]`;
    } else if (kind === 'resume') {
      if (!Array.isArray(log.resumes)) log.resumes = [];
      log.resumes.push(resumeEntry(log, entry.noNinja));
      log.status = 'running';
      saveLog(file, log);
      return `resumes[${log.resumes.length - 1}], status running`;
    } else Object.assign(log, entry);
  }
  saveLog(file, log);
  const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
  return list ? `${list}[${log[list].length - 1}]` : kind === 'init' ? 'the first log' : Object.keys(entry).join(', ');
}

/**
 * D-412: adds a finalized card's build (`{id, roll, status: "queued"}`: its folder `builds/<id>`, no guide, no PoB file
 * yet), or changes an existing build's status, guide or PoB file. A card that has a build is never finalized again
 * (D-411), and its identity never changes. Returns the log; throws an Error saying why not.
 */
function upsertBuild(log, entry) {
  if (!Array.isArray(log.builds)) log.builds = [];
  const at = log.builds.findIndex((b) => isObj(b) && b.id === entry.id);
  if (at < 0) {
    if (entry.roll === undefined || entry.status !== 'queued') throw new Error(`build entry refused: ${entry.id} has no build yet; a new build is {"id", "roll", "status": "queued"}, added when the verification gate finalizes its card (D-411, D-412)`);
    log.builds.push({ id: entry.id, roll: entry.roll, status: 'queued', folder: `builds/${entry.id}`, guide: entry.guide ?? null, pobFile: entry.pobFile ?? null });
    return log;
  }
  const b = log.builds[at];
  if (entry.roll !== undefined && JSON.stringify(entry.roll) !== JSON.stringify(b.roll)) throw new Error(`build entry refused: ${entry.id}'s identity is ${JSON.stringify(b.roll)}; a build keeps its card's identity (D-286)`);
  if (entry.status === 'queued' && b.status !== 'queued') throw new Error(`build entry refused: ${entry.id} already has a build (${b.status}); a card with a build in the run isn't finalized again: revise it at its design gate, or make a new card from it (D-411)`);
  for (const k of ['status', 'guide', 'pobFile']) if (entry[k] !== undefined) b[k] = entry[k];
  log.builds[at] = Object.fromEntries(BUILD_FIELDS.map((k) => [k, b[k] ?? null]));
  return log;
}

/**
 * D-412: a design or final checkpoint names a build of the run; the verification gate finalizes only cards with no
 * build yet (D-411); a resume's `guide:<id>`, `campaign:<id>` and `design:<id>` name a build in the status it needs
 * (D-415): `guide:` a file-only build, `campaign:` a completed or file-only one, `design:` a stopped or dropped one,
 * and only after a resume.
 */
function buildsAgainstRun(log, entry) {
  const bad = [];
  const builds = objects(log.builds);
  const has = (id) => builds.find((b) => b.id === id);
  if (['design', 'final'].includes(entry.checkpoint) && !has(entry.concept)) bad.push(`concept ${entry.concept} names no build of the run; builds[] holds ${builds.map((b) => b.id).join(', ') || 'none'} (D-412)`);
  if (entry.checkpoint === 'verification' && /^pick:/.test(String(entry.answer))) {
    for (const id of idsOf(entry.answer)) if (has(id) && has(id).status !== 'queued') bad.push(`${id} already has a build (${has(id).status}); a card with a build in the run isn't finalized again: revise it at its design gate, or make a new card from it (D-411)`);
  }
  const r = entry.checkpoint === 'verification' ? RESUME_ANSWER.exec(String(entry.answer)) : null;
  if (r) {
    const b = has(r[2]);
    const want = { guide: ['file-only'], campaign: ['completed', 'file-only'], design: ['stopped', 'dropped'] }[r[1]];
    if (objects(log.resumes).length === 0) bad.push(`${entry.answer} is an answer a resume offers; this run hasn't been resumed (D-415)`);
    if (!b) bad.push(`${r[2]} has no build in the run (D-415)`);
    else if (!want.includes(b.status)) bad.push(`${r[1]}:${r[2]} needs a ${want.join(' or ')} build, and ${r[2]} is ${b.status} (D-415)`);
  }
  return bad;
}

/** The pin's commit, read from `pob-pin.json` at the repository root (D-412: the runner runs no git); null when unreadable. */
export function pinCommit(repo = REPO) {
  try {
    const pin = JSON.parse(fs.readFileSync(path.join(repo, 'pob-pin.json'), 'utf8'));
    return text(pin?.commit) ? pin.commit : null;
  } catch {
    return null;
  }
}

/**
 * D-412: the newest league digest's file name, `data/league/<name>.md`, newest by the fetch date on its third line
 * ("… on poe2db.tw, fetched <YYYY-MM-DD>. …"), then by name; null when there is none.
 */
export function newestDigest(repo = REPO) {
  const dir = path.join(repo, 'data', 'league');
  let names;
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return null;
  }
  const dated = names.map((f) => {
    const third = (readText(dir, f) ?? '').split(/\r?\n/)[2] ?? '';
    return { f, date: /\bfetched (\d{4}-\d{2}-\d{2})\b/.exec(third)?.[1] ?? null };
  }).filter((d) => d.date !== null).sort((a, b) => (a.date === b.date ? a.f.localeCompare(b.f) : a.date.localeCompare(b.date)));
  return dated.length > 0 ? dated[dated.length - 1].f : null;
}

/** Today's date, YYYY-MM-DD, in local time. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * D-415: a resume's entry, `{date, pinCommit, digest, noNinja, lengths}`: the session's date, the pin's commit and the
 * newest digest as the repository holds them now, the session's --no-ninja, and the lengths of `stages[]`,
 * `checkpoints[]`, `escalations[]` and `displays[]` at the resume, so every entry after it can be placed.
 */
function resumeEntry(log, noNinja) {
  const n = (k) => (Array.isArray(log[k]) ? log[k].length : 0);
  return { date: today(), pinCommit: pinCommit(), digest: newestDigest(), noNinja, lengths: { stages: n('stages'), checkpoints: n('checkpoints'), escalations: n('escalations'), displays: n('displays') } };
}

/** The log at `file`, schema 3 or 4, or throws an Error saying why not. */
function readLog(file) {
  let log;
  try {
    log = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`run-log.json can't be read (${err.code ?? err.message}); write the first log with init`);
  }
  if (!isObj(log) || ![3, 4].includes(log.schemaVersion)) throw new Error("run-log.json isn't a schema-3 or schema-4 log; this script writes schema 4, and appends to a schema-3 log until migrate rewrites it");
  return log;
}

// ---------------------------------------------------------------------------------------------------
// Migrating a schema-3 log to schema 4 (D-415)
// ---------------------------------------------------------------------------------------------------

/** The escalation whose stage entry is `stages[i]` (the k-th escalated stage is escalations[k]), or undefined. */
function escalationAt(log, i) {
  const k = stagesOf(log).slice(0, i).filter((s) => s.outcome === 'escalated').length;
  return objects(log.escalations)[k];
}

/**
 * The card each design gate visit of a schema-3 log showed: the D1 gate entry before it, in order. A D1 gate leads to
 * the design gate when it passed, or escalated and the user accepted, before its card's guide was written (the design
 * gate is never asked in a fix round or a revision, D-362).
 */
function designVisitCards(log) {
  const out = [];
  const written = new Set();
  const stages = log.stages.filter(isObj);
  stages.forEach((s, i) => {
    if (s.stage === 'W1' && s.outcome !== 'missing') written.add(s.concept);
    if (s.stage !== 'D1-gate' || written.has(s.concept)) return;
    if (s.outcome === 'pass' || (s.outcome === 'escalated' && escalationAt(log, log.stages.indexOf(s))?.choice === 'accept')) out.push(s.concept);
  });
  return out;
}

/**
 * D-415: the status a schema-3 run's build migrates with, from the run's status and the last answer about its card:
 * the final gate's (accept completed, a decline not-accepted, the default stop stopped), else its last escalation's
 * (stop escalated, verification dropped), the design gate's (stop stopped, verification dropped) or an infeasible D1
 * gate (dropped); a build with none of these is still in progress (designing, or writing once a D2 gate passed), or
 * stopped when the run stopped.
 */
export function legacyBuildStatus(log, id) {
  const stages = objects(log.stages);
  const mine = stages.map((s, i) => ({ s, i })).filter(({ s }) => s.concept === id && s.outcome !== 'missing');
  const finals = objects(log.checkpoints).filter((c) => c.checkpoint === 'final');
  const last = finals[finals.length - 1];
  if (last && !/^revise:/.test(String(last.answer))) {
    if (last.answer === 'accept') return 'completed';
    if (last.answer === 'stop' && last.answeredBy === 'default') return 'stopped';
    return 'not-accepted';
  }
  const gate = mine.filter(({ s }) => s.stage === 'D1-gate' || s.stage === 'D2-gate').pop();
  if (gate?.s.outcome === 'escalated') {
    const e = escalationAt(log, gate.i);
    if (e?.choice === 'stop') return 'escalated';
    if (e?.choice === 'verification') return 'dropped';
  }
  if (gate?.s.stage === 'D1-gate' && gate.s.outcome === 'infeasible') return 'dropped';
  const design = objects(log.checkpoints).filter((c) => c.checkpoint === 'design' && c.concept === id).pop();
  const afterDesign = gate?.s.stage === 'D1-gate' && (gate.s.outcome === 'pass' || gate.s.outcome === 'escalated');
  if (design && afterDesign && !mine.some(({ s, i }) => i > gate.i && s.stage === 'D2')) {
    if (design.answer === 'stop') return 'stopped';
    if (design.answer === 'verification') return 'dropped';
  }
  if (log.status === 'stopped' || log.status === 'escalated') return log.status;
  return mine.some(({ s }) => s.stage === 'D2-gate' && s.outcome === 'pass') ? 'writing' : 'designing';
}

/**
 * D-415: rewrites a schema-3 log as schema 4. `roll` and `outputs` go; `dossier` is run-wide (the old outputs', else
 * dossier.md when the folder holds it); the run's finalized card, when it has one, becomes `builds[0]` with `folder:
 * "."` (its files stay at the root), its roll, its migrated status, `guide` from whether a guide exists, and the old
 * outputs' PoB file; its design and final checkpoints get `concept` from the D1 gate entry before each; a final-gate
 * decline's free text gets the `decline:` prefix; `noNinja`, the pin's commit and the digest are null, and `resumes[]`
 * starts empty. Returns the new log; throws an Error saying why not.
 */
export function migrateLog(runFolder, log) {
  if (!isObj(log) || log.schemaVersion !== 3) throw new Error(`migrate refused: run-log.json is ${isObj(log) && log.schemaVersion === 4 ? 'already a schema-4 log' : "no schema-3 log"}; migrate rewrites a schema-3 log as schema 4 (D-415)`);
  const checkpoints = objects(log.checkpoints).map((c) => ({ ...c }));
  const id = checkpoints.filter((c) => c.checkpoint === 'verification' && new RegExp(`^pick:${CARD_ID}$`).test(String(c.answer))).map((c) => c.answer.slice(5)).pop() ?? null;
  const visits = designVisitCards(log);
  const lastGate = objects(log.stages).filter((s) => s.stage === 'D1-gate' && s.outcome !== 'missing').pop()?.concept ?? id;
  let k = 0;
  const named = checkpoints.map((c) => {
    if (c.checkpoint === 'design') {
      const concept = visits[k] ?? visits[visits.length - 1] ?? lastGate;
      k += 1;
      return withConcept(c, concept);
    }
    if (c.checkpoint !== 'final') return c;
    const declined = !(c.answer === 'accept' || /^revise:./s.test(String(c.answer)) || /^decline:/.test(String(c.answer)) || (c.answer === 'stop' && c.answeredBy === 'default'));
    return withConcept({ ...c, ...(declined ? { answer: `decline:${c.answer}` } : {}) }, lastGate);
  });
  const old = { ...log, checkpoints: named };
  const outputs = isObj(log.outputs) ? log.outputs : {};
  const builds = id !== null && isObj(log.roll) ? [{
    id, roll: log.roll, status: legacyBuildStatus(old, id), folder: '.', guide: fs.existsSync(path.join(runFolder, 'guide.md')) ? 'full' : null,
    pobFile: text(outputs.pobFile) ? outputs.pobFile : null,
  }] : [];
  return {
    schemaVersion: 4, runFolder: log.runFolder, slug: log.slug, brief: log.brief, status: log.status, mode: log.mode, testConfig: log.testConfig,
    noNinja: null, pinCommit: null, digest: null,
    dossier: text(outputs.dossier) ? outputs.dossier : fs.existsSync(path.join(runFolder, 'dossier.md')) ? 'dossier.md' : null,
    builds, stages: Array.isArray(log.stages) ? log.stages : [], checkpoints: named, displays: Array.isArray(log.displays) ? log.displays : [],
    escalations: Array.isArray(log.escalations) ? log.escalations : [], faults: Array.isArray(log.faults) ? log.faults : [], resumes: [],
  };
}

/** A checkpoint with `concept` after `checkpoint`, the field order schema 4 writes. */
const withConcept = (c, concept) => {
  const { checkpoint, ...rest } = c;
  return concept === null || concept === undefined ? c : { checkpoint, concept, ...rest };
};

/** `migrate`: reads the run folder's schema-3 log and writes it back as schema 4. Returns what it did. */
export function migrate(runFolder) {
  const file = path.join(runFolder, 'run-log.json');
  let log;
  try {
    log = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`migrate refused: run-log.json can't be read (${err.code ?? err.message})`);
  }
  const next = migrateLog(runFolder, log);
  saveLog(file, next);
  return `migrated run-log.json to schema 4${next.builds.length > 0 ? `, ${next.builds[0].id} as builds[0] in "." (${next.builds[0].status})` : ', with no build'}`;
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
/** D-406: the structure check's optional last line, `- A stronger structure? <the flip, and the rough multiplier>`. */
export const STRONGER = 'A stronger structure?';

/**
 * D-406: a card's `### Structure check`, in its verification half: its top-level items `- <text>` (indented lines
 * joined to them) with their line numbers, the H2 it sits under, and its stronger-structure line `- A stronger
 * structure? <text>` (`stronger`, the text after the question mark; `strongerLast`, whether it is the section's last
 * item). Null when the card has no such heading.
 */
function structureCheck(lines) {
  const at = lines.findIndex((l) => /^###\s+Structure check\s*$/.test(l));
  if (at < 0) return null;
  const h2 = lines.slice(0, at).filter((l) => /^##\s/.test(l)).pop()?.replace(/^##\s+/, '').trim() ?? null;
  const items = [];
  for (let i = at + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i += 1) {
    const l = lines[i];
    const item = /^[-*]\s+(.*)$/.exec(l);
    if (item) items.push({ text: item[1].trim(), line: i + 1 });
    else if (items.length > 0 && /^\s+\S/.test(l)) items[items.length - 1].text += ` ${l.trim().replace(/^[-*]\s+/, '')}`;
  }
  const k = items.findIndex((x) => x.text.startsWith(STRONGER));
  return {
    line: at + 1, h2, items,
    stronger: k < 0 ? null : items[k].text.slice(STRONGER.length).trim(),
    strongerLine: k < 0 ? null : items[k].line,
    strongerLast: k < 0 || k === items.length - 1,
  };
}

/**
 * A card file's Pitch (D-392): each top-level item `- <Field>: <text>` under `### Pitch`, its indented lines
 * joined to it (a nested item with "; "). Returns `{name, fields, changed, made, structure}`: the name (`Name`, or a
 * card from before amendment 7's `Title`), every field by its name (`Obvious build` among them, D-403), the gate lines
 * R1b adds, `- Changed at the gate (visit <n>): <words>` and `- Made at the gate (visit <n>): from <name> and <name>:
 * <words>`, each `{visit, text, line}`, and the verification half's structure check (D-406, `structureCheck`).
 */
export function parseCard(textOrNull) {
  const out = { name: null, fields: new Map(), changed: [], made: [], structure: null };
  if (typeof textOrNull !== 'string') return out;
  const lines = textOrNull.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
  out.structure = structureCheck(lines);
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
 * A deck line's engine part (D-405), `engine: <family> from <family>`: `{raw, ok, consumed, supply}`, `ok` false
 * when the part isn't two lower-case words joined by " from " (the run checker holds the words to
 * data/rules/vocabulary.md).
 */
export function engineOf(part) {
  const m = /^engine:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s+from\s+([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/.exec(part);
  return m ? { raw: part, ok: true, consumed: m[1], supply: m[2], key: `${m[1]} from ${m[2]}` } : { raw: part, ok: false, consumed: null, supply: null, key: null };
}
/** A deck line's `can't be finalized yet: <why>` part (D-303), any apostrophe. */
export const CANT_FINALIZE = /^can['’]t be finalized yet\b/i;
/** D-400: a deck line's `waits on the pin: <entry>` part, on a card that can't be finalized yet. */
export const WAITS_ON_PIN = /^waits on the pin\b/i;

/**
 * The deck `cards.md` (D-287, D-391, D-392): its H2s in order, the header's two texts, each line `- <id> "<Name>" |
 * <part> | …` with its section (`Round <k>` or `Not dealt`), and the found-not-used items. A gate-made card's line
 * carries the part `made at the gate (visit <n>): from "<Name>" and "<Name>"`, an under-played one the part
 * `under-played (judgment: <why>)`. Amendment 8: a line's `engine: <family> from <family>` parts (`engines`, D-405)
 * and its `waits on the pin: <entry>` part (`waits`, D-400).
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
      engines: parts.filter((p) => /^engine\b/i.test(p)).map(engineOf),
      waits: parts.find((p) => WAITS_ON_PIN.test(p)) ?? null,
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
/** The last logged attempt of one of `names` that returned its file (and wasn't refused, D-421), for `concept` when given. */
const lastStage = (log, names, concept) => stagesOf(log).filter((s) => names.includes(s.stage) && !['missing', 'refused'].includes(s.outcome) && (concept === undefined || s.concept === concept)).pop();
/** D-412: a build's folder in the run folder: its builds[] entry's (`builds/<id>`, or "." for a migrated run's build), else ".". */
export const folderOf = (log, id) => objects(log.builds).find((b) => b.id === id)?.folder ?? '.';
/** A path inside a build's folder, relative to the run folder. */
export const inFolder = (folder, rel) => (folder === '.' || folder === '' ? rel : `${folder}/${rel}`);
/**
 * The compile record a D1 gate verdict read: its `recordPath`, relative to the run folder or to the build's folder,
 * else the build folder's `compile-record.json`.
 */
function gateRecord(dir, gate, folder) {
  const at = typeof gate?.recordPath === 'string' ? [gate.recordPath, inFolder(folder, gate.recordPath)] : [];
  for (const rel of [...at, inFolder(folder, 'compile-record.json')]) {
    const r = readJson(dir, rel);
    if (r !== null) return r;
  }
  return null;
}
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
/** The design gate's, in its figures' order (D-407): the pace first, then the boss check, then damage and toughness. */
const PACE_FIRST = "Clear speed is a rough estimate from the main skill's area; movement speed is PoB's, over your base speed; damage is PoB's damage per second for the main skill; effective HP is PoB's estimate of the damage it takes to kill you.";
/**
 * D-407: the player's movement speed, a multiplier: the record's `measures.movementSpeed`, else PoB's
 * `EffectiveMovementSpeedMod` in its outputs (a record from before WU-88); null when neither is a number.
 */
const moveOf = (rec) => (isNum(rec?.measures?.movementSpeed) ? rec.measures.movementSpeed : isNum(rec?.outputs?.EffectiveMovementSpeedMod) ? rec.outputs.EffectiveMovementSpeedMod : null);
/** A movement multiplier as a bonus over the base speed, in whole percent, as render-audit.mjs writes it: 1.251 is "+25%". */
const moveWords = (m) => {
  if (!isNum(m)) return 'not measured';
  const p = Math.round((m - 1) * 100);
  return `${p < 0 ? '' : '+'}${p}% over your base speed`;
};
/**
 * D-407: PoB gives the measured clear skill no area (`noArea`), so its band reads slow for want of a radius. A stage
 * with no clear skill (`skill` null) carries the flag too, but there's no skill to say it of.
 */
const noArea = (c) => isObj(c) && c.noArea === true && typeof c.skill === 'string';
/** A skeleton's measured clear speed in words (D-407): the record's speed, never its band, and why it may read slow. */
function clearPhrase(c) {
  if (noArea(c)) return `${c.speed} (PoB gives no area)`;
  if (typeof c?.skill !== 'string') return `${speedOf(c)} (a rough estimate; PoB measured no clear skill)`;
  return `${speedOf(c)} (a rough estimate from ${c.skill}'s area)`;
}
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
  // D-419: the D1 gate's tree part, PoB's node power on each rung.
  tree: { pass: 'no passive swap left gains 5% or more damage', fail: 'a passive swap left gains 5% or more damage', unverified: "the passive tree's swaps weren't checked" },
};
const GATE_WHAT = { 'D1-gate': 'The endgame design', 'D2-gate': 'The whole plan, from level 1 to the endgame', F1: "The endgame build's final compile", R1b: "The card's skeleton build" };
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
/** Schema 4's invitations (D-411, D-415): 1 to 3 builds to finalize; the PoB file alone; the campaign; more cards after. */
const INVITE4 = {
  ...INVITE,
  verification: 'Ask anything about these builds first. Then say in your own words which 1 to 3 to finalize, in your order, with any changes; or verify other cards, make a new one, brainstorm more, or stop.',
  resumed: 'For a build of this run, you can also have its guide written (a PoB file only), add its campaign, or see its design gate again.',
  design: 'Ask anything about this build first. Then accept it (its endgame guide follows), take its PoB file only, ask for changes, go back to the verification gate to finalize another card, or stop.',
  final: 'Ask anything about the guide first. Then accept it, accept it and go back to the verification gate for more builds, add the campaign, ask for changes, or say that you decline it.',
};
/** D-412: a build's status in words, for the verification display's list of the run's builds. */
const BUILD_WORDS = {
  queued: 'queued: its design comes next',
  designing: 'being designed',
  writing: 'its guide is being written',
  completed: 'completed',
  'file-only': 'its PoB file only, no guide yet',
  'not-accepted': 'you declined its guide',
  dropped: 'dropped at its design, back here',
  stopped: 'stopped',
  escalated: 'stopped at an escalation',
};
const reference = (items) => (items.length > 0 ? ['', 'For reference:', ...items.map((l) => (l.startsWith(' ') ? l : `- ${l}`))] : []);

function briefLine(log) {
  const brief = isObj(log.brief) ? Object.entries(log.brief).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : '';
  return `Brief: ${brief || 'none (surprise me)'}`;
}

/**
 * One card's pitch lines (D-392): its five lines, then the obvious card's kit (D-403), Unusual, a link not confirmed,
 * a gate's mark, and why it can't be finalized yet, with the entry it waits on (D-303, D-400).
 */
function pitchLines(card, plain, deckLine) {
  const field = (k) => card.fields.get(k)?.value;
  const out = PITCH_LINES.map((k) => `   ${k}: ${text(field(k)) ? plain(field(k)) : 'not given'}`);
  if (text(field('Obvious build'))) out.push(`   Obvious build: ${plain(field('Obvious build'))}`);
  if (text(field('Under-played (judgment)'))) out.push(`   Unusual: ${plain(field('Under-played (judgment)'))}`);
  if (text(field('Not confirmed'))) out.push(`   Not confirmed: ${plain(field('Not confirmed'))}`);
  for (const g of card.made) out.push(`   Made at the gate (visit ${g.visit}): ${plain(g.text)}`);
  for (const g of card.changed) out.push(`   Changed at the gate (visit ${g.visit}): ${plain(g.text)}`);
  const cant = deckLine?.parts.find((p) => CANT_FINALIZE.test(p));
  if (cant) out.push(`   ${plain(cant).replace(/^c/, 'C')}.`);
  const waits = /^waits on the pin:\s*(.+)$/i.exec(deckLine?.waits ?? '')?.[1];
  if (waits) out.push(`   Waits on PoB: ${plain(waits)} isn't in the PoB version this run uses, so the build can't be measured yet.`);
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
    against: boss === undefined || boss === 'None' ? 'map monsters' : `a boss (PoB's ${boss} setting)`,
    clear: isObj(rec.measures?.clearSpeed) ? rec.measures.clearSpeed : null, move: moveOf(rec),
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
    // D-408: the rival's card is shown beside the others, marked as the rival.
    const rival = RIVAL_CARD.test(r.id);
    out.push(`${k + 1}. ${name(r.id)}${rival ? ', the rival' : ''}: ${statusWords(r.cell('Status'), plain)}.`);
    if (rival) out.push('   The rival: a researcher with fresh context wrote it to clear faster than the other cards.');
    if (text(field('Why pick it'))) out.push(`   Why pick it: ${plain(field('Why pick it'))}`);
    const fig = /^viable\b/i.test(r.cell('Status')) ? skeletonFigures(dir, r.id) : null;
    // D-407: the pace leads, the skeleton's measured clear speed and movement speed, then the boss floor (the card's
    // Bosses line: a skeleton has no Arbiter check), then damage and toughness. A record from before WU-88 has no
    // measures, so a verified card's "How it clears" stands in, marked as the estimate it is; when PoB gives the clear
    // skill no area, the card's estimate leads. Beside a measured clear speed, "How it clears" is the card's estimate of
    // the time to first damage on a new pack, which PoB doesn't measure, so it is marked "(an estimate)" too.
    const pace = fig?.clear ?? null;
    const how = text(field('How it clears')) ? plain(field('How it clears')) : null;
    if (how && noArea(pace)) out.push(`   How it clears: ${how} (the card's estimate)`);
    if (pace) out.push(`   Clear speed: ${clearPhrase(pace)}.`, `   Movement speed: ${moveWords(fig.move)}.`);
    if (how && !noArea(pace)) out.push(`   How it clears: ${how}${pace ? ' (an estimate)' : fig !== null ? ' (an estimate; measured at the design)' : ''}`);
    if (text(field('Bosses'))) out.push(`   Bosses: ${plain(field('Bosses'))}`);
    if (fig) {
      const measured = fig.estimate ? 'an estimate: a Count above 1 or a custom modifier carries it' : 'modelled in PoB';
      out.push(`   Damage: ${whole(fig.dps)} per second from ${fig.minion ? `${fig.skill}'s minions` : fig.skill}, against ${fig.against} (${measured}).`);
      out.push(`   Toughness: ${whole(fig.life)} life and ${whole(fig.ehp)} effective HP (PoB's estimate of the damage it takes to kill you).`);
    }
    const prices = r.cell('Key prices');
    if (text(prices) && !/^[—-]+$/.test(prices)) out.push(`   Key prices: ${plain(prices)}${/^none\b/i.test(r.cell('League')) || /^[—-]*$/.test(r.cell('League')) ? '' : ` (league: ${r.cell('League')})`}.`);
    if (text(field('The catch'))) out.push(`   The catch: ${plain(field('The catch'))}`);
    const risk = r.cell('Main risk');
    if (text(risk) && !/^[—-]+$/.test(risk)) out.push(`   Found in verification: ${plain(risk)}`);
    // D-406: the structure check's stronger structure, under the card, so the user can make a new card from it.
    if (text(card.structure?.stronger)) out.push(`   ${STRONGER} ${plain(card.structure.stronger)}`);
    for (const g of card.made) out.push(`   Made at the gate (visit ${g.visit}): ${plain(g.text)}`);
    for (const g of card.changed) out.push(`   Changed at the gate (visit ${g.visit}): ${plain(g.text)}`);
    out.push('');
    ref.push(`${k + 1}. ${name(r.id)}: ${r.id}`);
  });
  // D-408: a rival that found no faster structure says so, with what it tried.
  const rv = lastStage(log, ['RV']);
  if (rv?.outcome === 'none-found') out.push(`The rival, a researcher with fresh context, found no structure that clears faster. What it tried: ${text(rv.tried) ? plain(rv.tried) : 'not given'}`, '');
  const lastR1b = new Map();
  for (const s of stagesOf(log)) if (s.stage === 'R1b' && s.outcome !== 'missing') lastR1b.set(s.concept, s);
  for (const s of lastR1b.values()) if (s.outcome === 'fail') ref.push(`${name(s.concept)} (${s.concept}) failed: ${verdictFile(s)}`);
  // Back from a design (infeasible, an escalation, the design gate's verification): that card's evidence.
  const back = lastStage(log, ['D1-gate', 'D2-gate', 'F1']);
  if (back) {
    out.push(`Back from the design of ${name(back.concept)}: its last check ${OUTCOME_WORDS[back.outcome] ?? back.outcome}.`, '');
    ref.push(`Last design verdict, ${back.concept} (${back.outcome}): ${verdictFile(back)}`);
  }
  const v4 = log.schemaVersion === 4;
  if (v4) {
    // D-411: every build of the run with its status; D-415: a changed pin or digest since the run last ran.
    const builds = objects(log.builds);
    out.push('Builds in this run:', ...(builds.length > 0 ? builds.map((b) => `- ${name(b.id)}: ${BUILD_WORDS[b.status] ?? b.status}${b.guide ? `, with its ${b.guide === 'full' ? 'full' : 'endgame'} guide` : ''}.`) : ['None yet.']), '');
    for (const line of pinChanges(log)) out.push(line);
    if (pinChanges(log).length > 0) out.push('');
    if (builds.length > 0) ref.push(`Builds: ${builds.map((b) => `${name(b.id)}: ${b.id} (${b.status}, ${b.folder})`).join('; ')}`);
  }
  out.push(v4 ? INVITE4.verification : INVITE.verification);
  if (v4 && objects(log.resumes).length > 0 && objects(log.builds).length > 0) out.push(INVITE4.resumed);
  ref.push(`Dossier: ${path.join(dir, 'dossier.md')}`);
  return [...out, ...reference(ref)];
}

/**
 * D-415: when the pin's commit or the newest league digest differs from the one the run last recorded (the resume
 * before this session's, or init's), the verification display says so: a card verified on the old pin may still be
 * finalized, its skeleton's figures the old pin's, and the design measures afresh.
 */
function pinChanges(log) {
  const recorded = [{ pinCommit: log.pinCommit, digest: log.digest }, ...objects(log.resumes)];
  const now = recorded.length > 1 ? recorded[recorded.length - 1] : { pinCommit: pinCommit(), digest: newestDigest() };
  const before = recorded.length > 1 ? recorded[recorded.length - 2] : recorded[0];
  const out = [];
  if (text(before.pinCommit) && text(now.pinCommit) && before.pinCommit !== now.pinCommit) {
    out.push(`PoB's version changed since this run last ran (commit ${before.pinCommit.slice(0, 7)}, now ${now.pinCommit.slice(0, 7)}): a card verified before keeps its skeleton's figures from the old version, and its design measures afresh.`);
  }
  if (text(before.digest) && text(now.digest) && before.digest !== now.digest) out.push(`The league digest changed since this run last ran (${before.digest}, now ${now.digest}).`);
  return out;
}

/** A plan's endgame stage label in words: "Entering maps (level 65)". */
function rungLabel(plan, id) {
  const st = objects(plan?.stages).find((s) => s.id === id);
  if (!st) return `Stage ${id}`;
  return `${RUNG_LABEL[st.variant] ?? st.loadoutName ?? `Stage ${id}`}${isNum(st.level) ? ` (level ${st.level})` : ''}`;
}

/** A percentage as the displays write it: a whole number as is, else one decimal. */
const pct = (v) => (isNum(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : '?');
const names = (v) => (Array.isArray(v) && v.length > 0 ? v.map(String).join(', ') : 'nothing');

/**
 * D-419: a rung's passive-tree lines on the design display, from the D1 gate verdict's `design.rungs[].tree`
 * (`{travel, points, bestSwap, needs}`, `bestSwap` null or `{gainPercent, removed, added}`): the travel and the best swap
 * left, then each need the tree keeps, one line each, so the user sees why a long branch stays.
 */
function treeLines(t) {
  const swap = isObj(t.bestSwap) ? `+${pct(t.bestSwap.gainPercent)}% Full DPS by moving ${Array.isArray(t.bestSwap.removed) ? t.bestSwap.removed.length : '?'} points from ${names(t.bestSwap.removed)} to ${names(t.bestSwap.added)}` : 'none';
  const needs = Array.isArray(t.needs) ? t.needs.filter(text) : [];
  return [`- Passive tree: ${isNum(t.travel) ? t.travel : '?'} of ${isNum(t.points) ? t.points : '?'} points on travel; best swap left: ${swap}`, ...needs.map((n) => `- Kept on the tree: ${n}`)];
}

function designDisplay(dir, log, id) {
  const s = lastStage(log, ['D1-gate'], id);
  if (!s) return [id ? `No D1 gate for ${id} in the run log.` : 'No D1 gate in the run log.'];
  const file = verdictFile(s);
  const gate = readJson(dir, file);
  if (!isObj(gate?.design)) return [`${file} has no design field.`];
  const folder = folderOf(log, s.concept);
  const plan = readJson(dir, inFolder(folder, 'plan.json'));
  const { name } = cardsOf(dir);
  // D-407: the D1 gate's record (its recordPath) gives each rung's movement speed and the clear skill's no-area flag.
  const record = gateRecord(dir, gate, folder);
  const out = [`The endgame build for ${name(s.concept)}, rung by rung, as its last design check measured it. ${PACE_FIRST}`, ''];
  for (const r of objects(gate.design.rungs)) {
    const rec = record?.stages?.[r.stage];
    const measured = rec?.measures?.clearSpeed;
    // D-407: the pace leads (the gate's clear-speed word, or the record's speed when PoB gives the skill no area), then
    // the boss floor, the Arbiter check, then damage and effective HP.
    out.push(`${rungLabel(plan, r.stage)}:`);
    out.push(`- Clear speed: ${noArea(measured) ? clearPhrase(measured) : `${speedOf(typeof r.clearSpeed === 'string' ? r.clearSpeed : measured)} (rough)`}.`);
    out.push(`- Movement speed: ${moveWords(moveOf(rec))}.`);
    if (r.arbiter !== null && r.arbiter !== undefined) out.push(`- The Arbiter of Divinity: ${arbiterWords(r.arbiter).replace(/^survives the Arbiter of Divinity's hits/, 'survives its hits').replace(/^one-shot by the Arbiter of Divinity's /, 'one-shot by its ')}.`);
    out.push(`- Damage: ${whole(r.dps)} per second.`);
    out.push(`- Effective HP: ${whole(r.ehp)}.`);
    for (const [k, label] of [['anoint', 'Anoint'], ['gear', 'Gear'], ['gems', 'Gems'], ['tree', 'Passive tree']]) if (text(r[k])) out.push(`- ${label}: ${r[k]}`);
    // D-419: schema 4's tree is the node-power summary, its needs one line each.
    if (isObj(r.tree)) out.push(...treeLines(r.tree));
    out.push('');
  }
  // An estimate the gate wrote for one rung (`b: …`) names the rung in words.
  const ids = new Set(objects(gate.design.rungs).map((r) => r.stage));
  const estimates = (Array.isArray(gate.design.estimates) ? gate.design.estimates.filter(text) : []).map((e) => e.replace(/^(\w+):\s*/, (m, rung) => (ids.has(rung) ? `${rungLabel(plan, rung)}: ` : m)));
  if (estimates.length > 0) out.push('Still estimates:', ...estimates.map((e) => `- ${e}`), '');
  out.push(verdictWords('D1-gate', gate.verdict), '', log.schemaVersion === 4 ? INVITE4.design : INVITE.design);
  const rungs = objects(gate.design.rungs).map((r) => `${rungLabel(plan, r.stage)}: ${r.stage}`);
  return [...out, ...reference([`Verdict: ${parts(gate.verdict)}`, `Verdict file: ${file}`, ...(rungs.length > 0 ? [`Rungs: ${rungs.join(', ')}`] : [])])];
}

async function finalDisplay(dir, log, id) {
  const { name } = cardsOf(dir);
  // D-413: a build's final compile is F1's (an endgame-only build) or the D2 gate's (a full build), whichever ran last.
  const d1 = lastStage(log, ['D1-gate'], id);
  const d2 = lastStage(log, id === undefined ? ['D2-gate'] : ['D2-gate', 'F1'], id);
  const d1gate = d1 ? readJson(dir, verdictFile(d1)) : null;
  const d2gate = d2 ? readJson(dir, verdictFile(d2)) : null;
  const card = id ?? d2?.concept ?? d1?.concept;
  const folder = folderOf(log, card);
  const at = (rel) => path.join(dir, ...inFolder(folder, rel).split('/'));
  const out = [
    `The guide${card ? ` for ${name(card)}` : ''}: ${at('guide.md')}`,
    `Its audit, how each number was checked: ${at('audit.md')}`,
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
  const v4 = lastStage(log, ['V4', 'V4-recheck', 'V4-campaign'], id);
  out.push('What was checked:');
  for (const [s, g] of [[d1, d1gate], [d2, d2gate]]) if (s) out.push(`- ${verdictWords(s.stage, g?.verdict)}`);
  if (v4) out.push(`- The guide's claims, against their sources: ${v4.outcome === 'pass' ? 'every one holds' : "some are still open; they're the known issues below"}.`);
  out.push(`- The run checker: ${Array.isArray(checker) ? (checker.length === 0 ? 'it found no problem' : `it found ${checker.length} problem(s), listed under For reference`) : "it didn't run"}.`, '');
  // D-369: each endgame rung's figures from the final record, and the design gate's where they moved since.
  const plan = readJson(dir, inFolder(folder, 'plan.json'));
  const record = readJson(dir, inFolder(folder, 'compile-record.json'));
  const atDesign = new Map(objects(d1gate?.design?.rungs).map((r) => [r.stage, r]));
  out.push(`The endgame, from the final build. ${FIGURES_MEAN}`);
  const rungIds = [];
  for (const variant of RUNGS) {
    const st = objects(plan?.stages).find((x) => x.variant === variant);
    if (!st) continue;
    rungIds.push(`${rungLabel(plan, st.id)}: ${st.id}`);
    const m = record?.stages?.[st.id]?.measures ?? {};
    const now = rungWords({ dps: m.dps, ehp: m.ehp, arbiter: variant === 'entering-maps' ? null : (m.arbiter ?? 'not measured'), clearSpeed: m.clearSpeed });
    // D-419: each rung's travel beside its figures, from the last D1 gate verdict file.
    const tree = atDesign.get(st.id)?.tree;
    out.push(`- ${rungLabel(plan, st.id)}: ${now}${isObj(tree) && isNum(tree.travel) ? `, ${tree.travel} of ${isNum(tree.points) ? tree.points : '?'} passive points on travel` : ''}.`);
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
  const guide = readText(dir, inFolder(folder, 'guide.md'));
  const lines = guide === null ? [] : guide.split('\n');
  const kiAt = lines.indexOf('### Known issues');
  const end = lines.findIndex((l, i) => i > kiAt && /^#{1,3} /.test(l));
  const issues = kiAt < 0 ? [] : lines.slice(kiAt + 1, end < 0 ? undefined : end).filter((l) => l.trim() !== '');
  out.push('', "What's still open, the guide's known issues:", ...(issues.length > 0 ? issues : ['None.']), '', log.schemaVersion === 4 ? INVITE4.final : INVITE.final);
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
export async function display(runFolder, gate, build) {
  if (!DISPLAYED.includes(gate)) throw new Error(`display: ${JSON.stringify(gate)} isn't one of ${DISPLAYED.join(', ')}`);
  const file = path.join(runFolder, 'run-log.json');
  const log = readLog(file);
  // D-411, D-412: in schema 4 the design and final gates are a build's, named with --build <id>; no other gate is.
  const perBuild = ['design', 'final'].includes(gate);
  if (log.schemaVersion !== 4 && build !== undefined) throw new Error('display: --build is schema 4\'s (amendment 9); this run log is schema 3');
  if (log.schemaVersion === 4 && perBuild && build === undefined) throw new Error(`display: the ${gate} gate is a build's: display ${gate} --build <card id> (D-411)`);
  if (build !== undefined && !perBuild) throw new Error(`display: --build goes with the design and final gates, not ${gate}`);
  if (build !== undefined && !objects(log.builds).some((b) => b.id === build)) throw new Error(`display: ${build} has no build in the run; builds[] holds ${objects(log.builds).map((b) => b.id).join(', ') || 'none'}`);
  const visit = (Array.isArray(log.checkpoints) ? log.checkpoints.filter((c) => isObj(c) && c.checkpoint === gate).length : 0) + 1;
  const body = await DISPLAYS[gate](runFolder, log, build);
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
  const kinds = ['init', 'stage', 'checkpoint', 'escalation', 'set', 'build', 'resume', 'display', 'test-config', 'migrate'];
  const displayBuild = args[1] === 'display' && args.length === 5 && args[3] === '--build';
  if (!kinds.includes(args[1]) || (args[1] === 'migrate' ? args.length !== 2 : args.length !== 3 && !displayBuild)) {
    process.stderr.write(`usage: node run-log.mjs <runFolder> <${kinds.slice(0, -3).join('|')}> '<json>' | -  (- reads the JSON from stdin), <runFolder> display <${DISPLAYED.join('|')}> [--build <card id>], <runFolder> test-config <path>, or <runFolder> migrate\n`);
    return 2;
  }
  if (args[1] === 'migrate') {
    try {
      process.stdout.write(`run-log: ${migrate(path.resolve(args[0]))}\n`);
      return 0;
    } catch (e) {
      process.stderr.write(`run-log: ${e.message}\n`);
      return 1;
    }
  }
  if (args[1] === 'display') {
    try {
      process.stdout.write(await display(path.resolve(args[0]), args[2], displayBuild ? args[4] : undefined));
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
