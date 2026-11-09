#!/usr/bin/env node
// The build-guide run log's writer (D-356): the runner writes run-log.json only through it, never with Write.
//
//   pob2-run-log <runFolder> init '{"slug", "brief", "mode", "testConfig", "noNinja"[, "status"]}'
//   pob2-run-log <runFolder> stage '{"stage", "concept"?, "attempt", "outcome", …}'
//   pob2-run-log <runFolder> checkpoint '{"checkpoint", "concept"?, "visit", "answer", "answeredBy", "rule"?, "questions"?, "changes"?, "newCards"?, "note"?}'
//   pob2-run-log <runFolder> escalation '{"stage", "concept", "verdict", "choice", "guidance"?}'
//   pob2-run-log <runFolder> build '{"id", "roll"?, "name"?, "status"?, "guide"?, "pobFile"?}'
//   pob2-run-log <runFolder> set '{"status"?, "dossier"?, "faults"?}'
//   pob2-run-log <runFolder> resume '{"noNinja"}'
//   pob2-run-log <runFolder> pricing '{"checkpoint", "answer"}'
//   pob2-run-log <runFolder> migrate
//   pob2-run-log <runFolder> display <brainstorm|verification|design|final|escalation> [--build <card id>]
//   pob2-run-log <runFolder> test-config <path>
//
// `-` in place of the JSON reads the entry from stdin, as a quoted heredoc gives it, so a text with an apostrophe
// (a brief's notes, a `revise:` text, a retry's guidance, a final-gate note, a gate change's words) needs no shell
// quoting:
//
//   pob2-run-log <runFolder> stage - <<'JSON'
//   {"stage", …}
//   JSON
//
// `init` writes the first log (schema 4, `runFolder` the folder given, empty lists) and never overwrites one; `stage`,
// `checkpoint` and `escalation` append one entry to `stages[]`, `checkpoints[]` or `escalations[]`; `set` replaces
// those top-level fields. Each entry has exactly the fields of skills/build-guide/references/run-log.md's entry form, and a wrong one is
// refused with nothing written. A schema-3 log takes schema 3's entries until `migrate` rewrites it. The run checker
// checks the whole log and its flow.
//
// Amendment 9 (WU-94; D-411…D-415, D-421), schema 4:
//  - the log: `{schemaVersion: 4, runFolder, slug, brief, status, mode, testConfig, noNinja, pinCommit, digest, dossier,
//    builds, stages, checkpoints, displays, escalations, faults, resumes}`; no run-level `roll` or `outputs`. `init`
//    takes `noNinja` (true or false, --no-ninja), and records the pin's commit from pob-pin.json and the newest league
//    digest's file name (data/league/<name>.md, newest by the fetch date on its third line), null when there is none
//    (from skill revision 15 the running leagues' digests, a list: amendment 16, below);
//  - `builds[]`, one per finalized card in finalize order, `{id, roll, status, folder, guide, pobFile}`: `build` adds one
//    `{"id", "roll", "status": "queued"}` (its folder `builds/<id>`), then changes its `status` (queued, designing,
//    writing, completed, file-only, not-accepted, dropped, stopped, escalated), its `guide` (null, endgame or full) or
//    its `pobFile`; a card with a build is never finalized again;
//  - `resume` appends `{date, pinCommit, digest, noNinja, lengths: {stages, checkpoints, escalations, displays}}`, the
//    session's --no-ninja and each list's length at the resume, sets the top-level `noNinja` to the session's flag (the
//    field every pricing step reads is the current session's; WU-95's fix round) and sets `status` running;
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
//  - M-22 (WU-102; D-426, D-427): the design display's movement speed line names the rung's travel skill and its uses
//    a second (the record's `measures.clearSpeed.travel`), and a best swap left that is a pool move (its `weaponSet`)
//    names its pool, `best swap left (weapon set <n>): …`.
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
// Amendment 10 (WU-105; D-429…D-435): the brainstorm round's coordinator step `R1a-synthesize` (schema 4, outcome
// `done`, a short round's `shortReason`), which composes the round's builds; a run whose first brainstorm round used
// `R1a-assemble` keeps it for every later round, and a write mixing the two is refused. The card id letter `s`, a
// composite `r<k>-s-<n>`. The brainstorm display of a composite deck (Appendix A): each composite's round line, then its
// `in:`, `scheduled:` and `out:` pieces, then the obvious build's line, then every plain card's name and structure, one
// line each. A new card's `from` names cards, composites, or piece keys: a Pieces row's key on a card of the run, or an
// Ideas line's id in a research file (D-432). `build` takes `name`, the build's name when its finalize revision gave it
// one (D-435), which render-audit.mjs titles its audit with. The design display prints `- Pieces: …` once, before the
// rungs, from the D1 gate's design field `pieces {in, scheduled, out, scheduledNames, outNames}` (D-434). The final
// display prints the run checker's `warnings` (D-435).
//
// Amendment 11 (WU-113; D-436…D-448, its Appendix A):
//  - `init` writes `skillRevision` (11 then; 12 from amendment 12) and `pricing: {stops: [], retries: []}`; `resume` stamps
//    both on an older log, with `skillRevisionFrom`, the four lists' lengths at the stamp, so the entries after it are held to amendment 11's rules
//    and the ones before it to their own (§19). A log without `skillRevision` is an older run's: it keeps the rival's
//    step RV and its `x` card, and its displays keep their old forms; a log with it refuses RV (D-443). A display reads
//    each artifact by its own format, so one written before a resume's stamp keeps its old form: the verification
//    display by the dossier's header (no number column is amendment 11's), the design display by the D1 gate's design
//    field (Appendix A's additions are amendment 11's), the final display by the record (`measures.damage`);
//  - D1-tree's outcome `respec` and D1-finish's `build` (§6, §14); D1-build's `priceOutcomes` (D-444), whose key
//    `exchange` counts the calls priced from poe.ninja's currency exchange, which send no trade request;
//  - the pricing stop (D-444): a `stage` entry counting a `rate_limited` or `locked_out` call records
//    `pricing.stops[] {at, step, outcome}` itself (`at` its index in stages[]); `pricing '{"checkpoint", "answer"}'` records
//    the user's answer at the next gate, `retry-pricing` or `no-retry`, as `pricing.retries[] {checkpoint, answer, at}`
//    (`at` the stages[] length then), accepted only while a stop is open and once that gate visit's display printed;
//  - the displays (§4, §5, §9, §9b, §10): the verification display shows no figure, only each card's status ("works",
//    "works, except …"), synergy, pitch lines, damage kinds, pieces, prices in players' words and risks, then "Numbers
//    come at the design gate"; the brainstorm display drops a composite's `out:` line and says "drawn from <host>" under
//    a card that cites a published guide (`external | <url>`, D-445); the design display prints each rung's damage
//    against map monsters, its boss line, the non-budget rung's floor and toughness lines, the cull and trigger lines,
//    "+<x>% damage" swaps, the trades from `trades.json` (a damage trade's `bossAfter`), and the pieces line counting
//    its out pieces; the final display prints both figures, the boss figure the record's evaluated `boss_<stage>`.
//
// Amendment 12 (WU-121; D-449…D-454, D-459, its §22 and Appendix A):
//  - `init` writes `skillRevision: 12`; `resume` stamps 12 on an older log, with one boundary per revision in
//    `skillRevisionFrom`, `{"11": {stages, checkpoints, escalations, displays}, "12": {…}}`: a boundary, at the same
//    lengths, for every revision above the log's old one, so a log from before amendment 11 gains both and a revision-11
//    log keeps 11's (its flat `skillRevisionFrom` reads as `{"11": …}`) and gains 12's. A revision `init` wrote has no
//    boundary and holds from the start. The scripts compare revisions by order, not equality (`heldFrom(log, list,
//    revision)`): amendment 11's rules hold from 11's boundary, this amendment's from 12's. A log at 12 refuses D1-tree's
//    `respec` outcome (D-452: one tree per loadout);
//  - the design display, read by the D1 gate's design field (a rung with `maxHit` is amendment 12's): on `b` and `n` the
//    Arbiter line from the deciding row with hits survived and the chances at the Arbiter, `under the 80% floor` on a
//    one-shot rung, then `Lowest max hit: <n> <type>` and PG-100's note when the record's `avoid.companionDeflected` says
//    a companion takes part of each deflected hit; per variant rung the resisting figure after the boss lines; on `n`
//    the Effective HP line's chance-layer share, the conditioned line and its band, the ailment line on a build that
//    deflects, and the warning;
//    the trades' `defence (one-shot)` and `avoidance` lines with their max hit and hits survived;
//  - the final display's rung lines with three figures (`measures.damage.resisting`) and the verdict label's three forms
//    (`arbiterWords`), and the design-to-final comparison in the same forms.
//
// Amendment 13 (WU-130; D-466, D-468, D-474, D-475, D-477, its §22 and Appendix A):
//  - `init` writes `skillRevision: 13`; `resume` stamps 13 on an older log with its boundary, as amendment 12 set up;
//  - the brainstorm display of a log at 13 (D-475), on the composite and the dealt-card paths alike: the header's first
//    one or two sentences and no "How they differ"; one first line per composite or dealt card, `<n>. <name>:
//    <structure>; under-played: yes|no`; at most 8 key pieces on its `in:` line, chosen by kind, then `+ <N> more in
//    cards.md`; `scheduled:` names only; the plain cards (and a dealt deck's not-dealt cards) on one line of names; no
//    "For reference": the visit's `displays[]` entry records the number-to-id map, `{checkpoint, visit, numbers}`;
//  - `builds[].draftFile` (D-466), the latest draft's path or null, beside `pobFile` on a log at 13; the design display
//    prints its name; the final display prints F1's `draftLeft` (Appendix A);
//  - the design display of a design field written under amendment 13's rules (a rung with `life`, `swapCap`, `rebuild`,
//    `removedForOthers`, `levels`, or `boss.start`): the boss rotation line with each entry's start, end and final
//    figure (an entry's `valuedBy` value and reason), the `boss-fall` reason, the `boss` trade with its `bossAfter`, the
//    Life, swap-cap, rebuild-undone, `Removed on` and `Skill levels on` lines (D-467, D-468, D-473);
//  - D1-tree's outcome `stale-server` (D-467) and the stage `V4-claims` (D-477, a file-only build's claims pass);
//  - the pricing stop `pace` (D-474): a step whose `priceOutcomes` counts `pace` (its first trade call's reply had no pace
//    line, or the pace was off) records its stop as `rate_limited` does;
//  - a Pieces row's kind `anoint` (D-474).
//
// Amendment 14 (WU-140; D-478…D-491, its §25 and Appendix A), for a log at 14 (`init` writes it, a resume stamps it with
// its boundary, as amendment 12 set up):
//  - the R1b entry's `skeletonFile` (the card's skeleton PoB file, `<card name> skeleton (draft).xml`, or null, D-479), and
//    `skeleton '{"concept"}'`, which sets `skeletonRemoved: true` on that card's last R1b entry with a skeleton file once
//    the runner removed it;
//  - `answer-change '{"checkpoint": "design", "visit", "from": "accept", "to": "accept:file", "note"}'` (D-480), legal after
//    the build's F1 pass and before its W1's entry, kept in `answerChanges[]` with its build (`concept`) and `at`, the
//    stages[] length when written; W1's outcome `cancelled`, only after an answer change; `withdrawals[] {build, files,
//    at}`, which `render-audit.mjs --withdraw` writes;
//  - a stage entry's `scope` (D1-finish's `swap` or `scaling`, W1's `notes`, D-481, D-486, D-487) and `requests`
//    (`[{id, words, result: "made" | "departs: <how>"}]`, D-482); D1-tree's `priceOutcomes` (D-490: any non-zero count
//    fails the checker);
//  - the checkpoint `ask` (`{checkpoint: "ask", kind: "departs" | "open-finding", build, visit, answer, answeredBy}`,
//    D-482), answered `round` or `ship` for an open finding and in the user's words for a departure, its `at` the stages[]
//    length when written; the design checkpoint's `scaling: true | false` on an accept (D-486);
//  - the displays (D-478, D-491; Appendix A's revision 14): the brainstorm display's headers and closing lines, the
//    verification display in bold labels and bullets with each card's skeleton file first, the design display in the
//    [GR] form from the D1 gate's `summary` (`display design --build <id> --detail` prints today's), the final display's
//    PoB file first; a clear skill with no area reads `no area: chains <n>, projectiles <m>` once the record has them.
//
// Amendment 16's M-29 (WU-151; D-507, C-59), skill revision 15 (`init` writes it, a resume stamps it with its boundary):
//  - `digest` is the running leagues' digests, `skills/game-knowledge/scripts/leagues.mjs`'s `runningDigests` over
//    `data/league/` at the machine's clock: a list of file names, the latest start first, possibly empty. The top-level
//    `digest` keeps the form of the revision `init` wrote (a string or null before 15), each `resumes[]` entry that of
//    its resume (a list from 15 on). `init` and `resume` print, after their first line, what the runner copies:
//    `digests: [<paths>]`, the task header's `digests`, then each running digest's third line (the staleness line) or
//    the none line, then each undated digest named once;
//  - D-415's line compares two lists as sets, and a string with a list's first entry: "The league digests changed since
//    this run last ran";
//  - the test clock: `BUILD_GUIDE_TEST_NOW=<instant>` (as `leagues.mjs --at` reads one) sets `now` for the league rule.
//    Tests only: a run never sets it.
//
// Amendment 16's M-30 (WU-159; D-516, C-61, its Appendix A.6), skill revision 16 (`init` writes it, a resume stamps it):
//  - a piece run, `Guides/<piece>/<date>-<n>/` for the piece `compile`, `pricing` or `writer`: `init '{"piece", "mode",
//    "testConfig", "noNinja", "status"?, "source"}'`, no `slug` or `brief`, writes A.6's log, `{schemaVersion: 4,
//    skillRevision: 16, piece, runFolder, status, mode, testConfig, noNinja, pinCommit, digest, source, stages,
//    checkpoints, displays, escalations, faults, resumes, pricing}`, with no `slug`, `brief`, `dossier` or `builds`;
//    `source` is what the run started from, `{kind: "builds-folder" | "import-code" | "run-folder", name?, sha1?, build?}`
//    (`run-folder`, with the source build's id, the writer's), and never holds an import code;
//  - a piece run logs only its piece's steps (A.6): compile `read`, `measure` and, in its better round, `place`, D1-build,
//    D1-tree, D1-finish, D1-gate and F1; pricing `read` and `price`; the writer W1. The steps `read`, `measure`, `place`
//    and `price` carry no concept; `place` and `price` carry `priceOutcomes`; a file run (`/pob2:build-guide` from a
//    file, slug `file`) logs `read`, `measure` and `place` too;
//  - the build id `file`, beside the card ids, wherever a compile run or a file run names its one build (a step's, a
//    design checkpoint's and an escalation's `concept`, a gate verdict's file name, `cards/file.md`); a writer run's W1
//    names its source's build;
//  - the scopes `better` (the better round, a compile run's or a file run's) and `ladder` (a file run's) on D1-build,
//    D1-tree, D1-finish and D1-gate;
//  - a pricing stop ends a piece run: the step's entry records `pricing.stops[]` as in the pipeline, its line tells the
//    runner to ask for the rung when none is placed, set the status `stopped`, say when the lockout ends and stop; `pricing`
//    (a gate's retry answer) is refused in a piece run, and a `resume` on the piece's folder clears the stop, the retry;
//  - `display design [--build file]` serves a compile run's better round from its root build, `display escalation` its
//    escalation; a piece run has no other gate, and no `build` entry.
// WU-162 (D-521): the better round's design display names its draft first (the gate's `draft`) and invites accept (F1
// writes the final PoB file), changes or stop; its design checkpoint takes `accept`, `revise:<text>` or `stop`, with no
// `scaling`, and its escalation no `verification`.
// WU-164 (D-522): a file run, `/pob2:build-guide` from a PoB file, is a pipeline log whose brief names the file (`from`, a
// builds-folder name or "import code"), with `better` (the better round first) and `campaign` (false: declined at the
// start); `init` refuses `from` without the slug `file`, the slug without `from`, and `better` or `campaign` without it.
// It has no brainstorm or verification gate (`fileRunGates`): no `verification` answer at its design gate or escalation,
// no `accept:verification` at its final gate, and its better round's design gate takes accept, revise:<text> or stop.
// Its design display serves the better round as a compile run's (the draft first, what the budget can't reach) and the
// ladder with the placed rung's costed findings, each inviting no way back to a verification gate.
//
// `test-config <path>` (D-394) checks a test config's shape and writes nothing: each gate's answers are strings, or
// objects `{ask, answer, changes, newCards, note}` scripting an interview; a design answer's object may carry `scaling`
// (D-486, default false). What needs the deck (a new card's `from` and its name) is checked when the gate's checkpoint is
// written.
// Exit 0: written, the display printed (stdout), or the test config well formed. Exit 1: refused (stderr). Exit 2:
// usage error.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { playersWords, bossFigure, arbiterFloor, ARBITER_FLOOR, arbiterReading, arbiterLabel12, hasHitsSurvived, survivedPercent, typeWords } from './render-audit.mjs';
import { runningDigests, report as leagueReport, instantOf } from '../../game-knowledge/scripts/leagues.mjs';

/**
 * A card id (D-319): `r<round>-<letter>-<n>`, the letters a to c a brainstorm round's researchers', g a card made at a
 * gate (D-391), s a composite R1a-synthesize composed (D-429), x the rival's (D-408).
 */
export const CARD_ID = 'r[1-9]\\d*-[a-cgsx]-[1-9]\\d*';
const CARD = new RegExp(`^${CARD_ID}$`);
/** A card made at a gate (D-391): `r<k>-g-<n>`. */
const GATE_CARD = /^r([1-9]\d*)-g-([1-9]\d*)$/;
/** The rival's card (D-408): `r<k>-x-<n>`, k the latest brainstorm round when its RV step ran, n counting the run's rivals in it. */
export const RIVAL_CARD = /^r([1-9]\d*)-x-([1-9]\d*)$/;
/** A composite (D-429): `r<k>-s-<n>`, k the brainstorm round whose R1a-synthesize composed it, n counting its composites. */
export const COMPOSITE_CARD = /^r([1-9]\d*)-s-([1-9]\d*)$/;
/** A researcher's card (D-319): `r<k>-<a|b|c>-<n>`. */
export const RESEARCHER_CARD = /^r([1-9]\d*)-[a-c]-([1-9]\d*)$/;
/**
 * A piece's key (Appendix A): an Ideas line's id `i<k><letter>-<m>` (round k, the researcher's letter, m from 1), or a
 * Pieces row's key from a card's links, `c<card id>-<m>`.
 */
export const PIECE_KEY = `(?:i[1-9]\\d*[a-c]-[1-9]\\d*|c${CARD_ID}-[1-9]\\d*)`;
const KEY = new RegExp(`^${PIECE_KEY}$`);
/** The brainstorm round's two coordinator steps: R1a-assemble deals cards, R1a-synthesize composes builds (D-429). */
export const ASSEMBLY_STAGES = ['R1a-assemble', 'R1a-synthesize'];
const IDS = `${CARD_ID}(?:,${CARD_ID}){0,2}`;
const TRADE_KINDS = ['no_session', 'session_rejected', 'too_complex', 'invalid_query', 'rate_limited', 'locked_out', 'would_wait', 'auth', 'http', 'network', 'timeout', 'disabled'];
/** Each stage and its outcomes (run-log.md); every step may also be `missing`. `Q` is a gate question step (D-390). */
const OUTCOMES = {
  R1a: ['done'],
  'R1a-assemble': ['done'],
  R1b: ['pass', 'fail'],
  'R1b-assemble': ['done'],
  'D1-build': ['done', 'infeasible'],
  // Amendment 11 (§14): D1-finish's `build`, its return `build: <ids>`, routes D1-build next in the same attempt.
  'D1-finish': ['done', 'claims-edited', 'build'],
  'D1-gate': ['pass', 'fail', 'infeasible', 'escalated'],
  D2: ['done', 'claims-edited'],
  'D2-gate': ['pass', 'fail', 'escalated'],
  // Amendment 14 (D-480): `cancelled`, a W1 stopped by an answer change (accept to accept:file) after F1.
  W1: ['done', 'cancelled'],
  V4: ['pass', 'fail'],
  'V4-recheck': ['pass', 'fail'],
  Q: ['done'],
  // D-408: the rival writes its card (`done`), or finds no faster structure (`none-found`, with what it `tried`).
  RV: ['done', 'none-found'],
  // Amendment 9 (schema 4): D1's tree step (D-418), the endgame-only build's final compile (D-413) and V4's campaign
  // pass (D-415). Amendment 11: D1-tree's `respec`, a scaling change D1-build missed (D-438), routes D1-build next.
  // Amendment 13 (D-467): D1-tree's `stale-server`, a session server built before M-26, routes D1-tree again once the
  // user reconnected it with /mcp.
  'D1-tree': ['done', 'respec', 'stale-server'],
  F1: ['pass', 'fail', 'escalated'],
  'V4-campaign': ['pass', 'fail'],
  // Amendment 10 (D-429): the brainstorm round's synthesis, which composes 1–4 composites; schema 4's only.
  'R1a-synthesize': ['done'],
  // Amendment 13 (D-477): a file-only build's claims pass, its plan's hinge claims checked with no guide.
  'V4-claims': ['pass', 'fail'],
  // Amendment 16's M-30 (D-516, Appendix A.6): a piece run's and a file run's own steps. `read` runs plan_from_build
  // (`fail` when it refused the file); `measure` the measure-only compile of the read plan (`fail` when it failed);
  // `place` places the read stage on the ladder; `price` prices the gear (a stop is its priceOutcomes').
  read: ['done', 'fail'],
  measure: ['done', 'fail'],
  place: ['done'],
  price: ['done'],
};
/** D-516 (Appendix A.6): the steps revision 16 adds, a piece run's and a file run's; none carries a concept. */
export const PIECE_STAGES = ['read', 'measure', 'place', 'price'];
/** The stages schema 4 adds (amendment 9, amendment 10's synthesis, and revision 16's piece steps); a schema-3 log has none. */
const SCHEMA4_STAGES = ['D1-tree', 'F1', 'V4-campaign', 'R1a-synthesize', 'V4-claims', ...PIECE_STAGES];
const NO_CONCEPT = ['R1a', 'R1a-assemble', 'R1a-synthesize', 'R1b-assemble', 'Q', 'RV', ...PIECE_STAGES];
/** The steps that price (pricing.md); D1-build since amendment 11, for its `find_upgrades` calls (D-444). */
const PRICING = ['R1b', 'D1-build', 'D1-finish', 'D1-gate', 'D2'];
/** D-516 (Appendix A.6): the piece steps that price, revision 16's: `place` (a compile run's and a file run's) and `price`. */
const PIECE_PRICING = ['place', 'price'];
/** D-490 (amendment 14): D1-tree makes no trade call, but a log at 14 records its count, so a call shows (and fails). */
const PRICING14 = [...PRICING, 'D1-tree'];
/** D-444: a `priceOutcomes` key for the calls priced from poe.ninja's currency exchange, which send no trade request. */
export const EXCHANGE = 'exchange';
/**
 * D-474 (amendment 13): a `priceOutcomes` key for the trade call whose reply carried no pace line, or `Pace: off (test
 * setting).`: the step made no more trade calls and returned the stop `pace: missing` or `pace: off`.
 */
export const PACE = 'pace';
/**
 * §19, amendment 12's §22, amendment 13's §22: the skill revision `init` writes and `resume` stamps; a log without it is
 * held to the rules before amendment 11.
 */
export const SKILL_REVISION = 16;
/** Amendment 11's revision (§19): its rules hold from its boundary in every log at 11 or later. */
export const A11 = 11;
/** Amendment 13's revision (§22): its rules hold a build from its boundary, read by the build's last D1 gate. */
export const A13 = 13;
/** Amendment 14's revision (§25): its rules hold a build from its boundary, read by the build's last D1 gate. */
export const A14 = 14;
/** Amendment 16's M-29 revision (§24, D-507): the run log's `digest` is the running leagues' list from it. */
export const A15 = 15;
/** Amendment 16's M-30 revision (§24, D-516): piece runs, the file run, the id `file` and the scopes better and ladder. */
export const A16 = 16;
/** Appendix A (amendment 12): the revisions a log can be held to, in order; each one's rules hold from its own boundary. */
export const REVISIONS = [11, 12, 13, 14, 15, 16];
/** D-481, D-486, D-487 (Appendix A): each step's `scope`, the task header's field that narrows it. */
export const SCOPES = { 'D1-finish': ['swap', 'scaling'], W1: ['notes'] };
/**
 * D-516 (§17, §18): the scopes revision 16 adds on D1's four steps: `better`, the better round on a read plan (a compile
 * run's or a file run's), and `ladder`, a file run's rungs designed around the placed one.
 */
export const SCOPES16 = { 'D1-build': ['better', 'ladder'], 'D1-tree': ['better', 'ladder'], 'D1-finish': ['better', 'ladder'], 'D1-gate': ['better', 'ladder'] };
/** A step's scopes in a log at `revision`: SCOPES', and from revision 16 SCOPES16's. */
export const scopesOf = (stage, revision) => [...(SCOPES[stage] ?? []), ...(revision >= A16 ? SCOPES16[stage] ?? [] : [])];
/** D-516 (C-61): the pieces a piece run is run by, each its own command (`/pob2:<piece>`) and its folder `Guides/<piece>/`. */
export const PIECES = ['compile', 'pricing', 'writer'];
/** D-516: the one build of a compile run and of a file run, named `file` where a pipeline run names a card. */
export const FILE_ID = 'file';
/** D-516 (Appendix A.6): the steps each piece logs. */
export const PIECE_STEPS = {
  compile: ['read', 'measure', 'place', 'D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'F1'],
  pricing: ['read', 'price'],
  writer: ['W1'],
};
/** D-516 (§12): what a piece run starts from, `source.kind`, by piece: a player's file, or (the writer's) a run folder. */
export const PIECE_SOURCE_KINDS = { compile: ['builds-folder', 'import-code'], pricing: ['builds-folder', 'import-code'], writer: ['run-folder'] };
/** D-516 (Appendix A.6): a piece run's `source`'s fields, in order. */
export const SOURCE_FIELDS = ['kind', 'name', 'sha1', 'build'];
/** A piece run's piece (D-516): the log's `piece`, one of the three, or null for a pipeline run's log. */
export const pieceOf = (log) => (isObj(log) && PIECES.includes(log.piece) ? log.piece : null);
/**
 * D-522 (§18, C-51): a file run, `/pob2:build-guide` from a PoB file: a pipeline log whose brief names the file it starts
 * from (`from`, a builds-folder name or "import code"); its slug is `file`.
 */
export const isFileRun = (log) => isObj(log) && pieceOf(log) === null && isObj(log.brief) && typeof log.brief.from === 'string' && log.brief.from.trim() !== '';
/**
 * D-522 (C-51, Appendix A.6): a file run's brief fields beside the pipeline's: `from`, the file (a builds-folder name, or
 * "import code": the code itself goes only to the reader), `better` (the better round first) and `campaign` (false: the
 * user declined the campaign at the start, so D2 doesn't run; the coordinator's proceed-on, beside A.6's two).
 */
export const FILE_BRIEF_FIELDS = ['from', 'better', 'campaign'];
/**
 * C-61 (Appendix A.6): whether a brief's `from` is an import code rather than a file's name: longer than a name may be, or
 * a run of base64 that inflates to a PoB document.
 */
export function looksLikeImportCode(v) {
  const s = String(v ?? '').trim();
  if (s.length > 255) return true;
  if (!/^[A-Za-z0-9+/_=-]{24,}$/.test(s)) return false;
  try {
    const xml = zlib.inflateSync(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString('utf8');
    return /<PathOfBuilding/.test(xml);
  } catch {
    return false;
  }
}
/** D-522: the problems of a pipeline `init`'s brief and slug against the file run's rules: `from` gives the slug `file`. */
export function fileBriefProblems(slug, brief) {
  if (!isObj(brief)) return [];
  const bad = [];
  const from = brief.from;
  if (from !== undefined && !(typeof from === 'string' && from.trim() !== '')) bad.push(`brief.from is ${show(from)}; the PoB file the run starts from, a builds-folder name or "import code" (the code itself goes only to the reader), D-522`);
  const file = typeof from === 'string' && from.trim() !== '';
  // C-61, Appendix A.6: an import code goes only to the reader, never in the log; its message never repeats it.
  if (file && looksLikeImportCode(from)) bad.push(`brief.from is ${from.length > 255 ? `${from.length} characters long` : 'a code that decodes as a PoB build'}: an import code goes only to the reader, never in the log, so from is "import code" (a builds-folder name is at most 255 characters) (C-61, D-522)`);
  if (file && slug !== FILE_ID) bad.push(`slug is ${show(slug)}; a run from a PoB file (brief.from) has the slug ${FILE_ID}: guide_run {new_run: "${FILE_ID}"} (D-522)`);
  if (!file && slug === FILE_ID) bad.push(`slug ${FILE_ID} is a run from a PoB file's, whose brief names the file in from; this brief has none (D-522)`);
  for (const k of ['better', 'campaign']) {
    if (brief[k] === undefined) continue;
    if (typeof brief[k] !== 'boolean') bad.push(`brief.${k} is ${show(brief[k])}; true or false (D-522)`);
    else if (!file) bad.push(`brief.${k} is a run from a PoB file's (brief.from); this brief names no file (D-522)`);
  }
  return bad;
}
/** D-516: whether a log names its one build `file`: a piece run (a writer run's W1 names its source's build), or a file run. */
export const takesFileId = (log) => pieceOf(log) !== null || isFileRun(log);
/** D-482: the steps that take the user's requests and return one `request:` line per request. */
export const REQUEST_STAGES = ['R1b', 'D1-build', 'D1-tree', 'D1-finish', 'D2', 'W1'];
/** D-482 (Appendix A): an `ask` checkpoint's kinds, and an open finding's two answers. */
export const ASK_KINDS = ['departs', 'open-finding'];
export const OPEN_FINDING_ANSWERS = ['round', 'ship'];
/** D-482: a request's result, `made` or `departs: <how>`. */
export const REQUEST_RESULT = /^(?:made|departs: \S[\s\S]*)$/;
/** A log's skill revision, a whole number, or null for a log without one (an older run's). */
export const revisionOf = (log) => (isObj(log) && Number.isInteger(log.skillRevision) ? log.skillRevision : null);
/**
 * D-444: the outcomes that stop trade-site pricing until the user approves a retry at a gate (or a resume clears it);
 * D-474 (amendment 13): `pace`, a reply with no pace line or the pace off.
 */
export const STOP_OUTCOMES = ['rate_limited', 'locked_out', PACE];
/** D-444: the answer to a gate's pricing question, asked only after a stop. */
export const RETRY_ANSWERS = ['retry-pricing', 'no-retry'];
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
  // Amendment 14 (Appendix A): R1b's `skeletonFile`; a step's `scope` and `requests` (D-479, D-481, D-482).
  stage: ['stage', 'concept', 'attempt', 'outcome', 'priceOutcomes', 'probes', 'skeletonFile', 'shortReason', 'tried', 'scope', 'requests'],
  // Amendment 14: the `ask` checkpoint's `kind` and `build` (D-482); the design accept's `scaling` (D-486).
  checkpoint: ['checkpoint', 'concept', 'kind', 'build', 'visit', 'answer', 'answeredBy', 'rule', 'questions', 'changes', 'newCards', 'note', 'scaling'],
  set: ['status', 'dossier', 'faults'],
  // D-516 (Appendix A.6): a piece run's `init` takes `piece` and `source` in place of `slug` and `brief`.
  init: ['slug', 'brief', 'piece', 'mode', 'testConfig', 'noNinja', 'status', 'source'],
  // D-466 (amendment 13): `draftFile`, the latest draft's path, on a log at 13.
  build: ['id', 'roll', 'name', 'status', 'guide', 'pobFile', 'draftFile'],
  resume: ['noNinja'],
  // D-444: the user's answer to a gate's pricing question after a stop.
  pricing: ['checkpoint', 'answer'],
  // Amendment 14 (D-479, D-480): a skeleton removed, an answer changed after F1, files withdrawn.
  skeleton: ['concept'],
  'answer-change': ['checkpoint', 'visit', 'from', 'to', 'note'],
  withdrawn: ['build', 'files'],
  // D-521: a compile run's D1 gate escalation accepted, its draft's path (the runner's draft call): a compile run has no
  // builds[] (Appendix A.6), so the draft's home is this entry, a departure from A.6.
  escalation: [...FIELDS.escalation, 'draftFile'],
};
/** Amendment 14 (Appendix A): the fields only a log at 14 takes, by kind. */
const FIELDS14 = { stage: ['skeletonFile', 'scope', 'requests'], checkpoint: ['kind', 'build', 'scaling'] };
/** The writes only a log at 14 takes (amendment 14, Appendix A). */
const KINDS14 = ['skeleton', 'answer-change', 'withdrawn'];
/** A build entry's fields in builds[], in order (D-412); `name` after `roll` once a build entry gave one (D-435). */
const BUILD_FIELDS = ['id', 'roll', 'status', 'folder', 'guide', 'pobFile'];
const BUILD_FIELDS_NAMED = ['id', 'roll', 'name', 'status', 'folder', 'guide', 'pobFile'];
/** The plugin root, the repository root here (scripts → build-guide → skills → root): `pob-pin.json` and `data/league/`. */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
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
  // D-432: `from` names cards and composites by id, and pieces by key (a Pieces row's key or an Ideas line's id).
  if (!Array.isArray(c.from) || c.from.length === 0 || !c.from.every((id) => CARD.test(String(id)) || KEY.test(String(id)))) bad.push('from lists the card ids it draws on, one or more, composites among them, or piece keys: a Pieces row\'s key or an Ideas line\'s id (D-432)');
  else if (new Set(c.from).size !== c.from.length) bad.push('from names a card twice');
  if (!text(c.words)) bad.push("has words, the user's words for the card");
  return bad;
}

/**
 * The problems with an entry of a kind: its fields, as run-log.md's entry form gives them, in the log's schema (3, or 4
 * from amendment 9). `opts.fileId`: the log names its one build `file` (a piece run or a file run, D-516).
 */
export function entryProblems(kind, e, schema = 3, revision = SKILL_REVISION, opts = {}) {
  if (!isObj(e)) return ['the entry is a JSON object'];
  const v4 = schema === 4;
  // D-516: a card id, or in a piece run or a file run its one build's id `file`.
  const isId = (v) => CARD.test(String(v)) || (v4 && opts.fileId === true && v === FILE_ID);
  const idWords = v4 && opts.fileId === true ? ` or ${FILE_ID}, the run's one build (D-516)` : '';
  // Amendment 14 (Appendix A): its fields and writes need a log at 14; an older log is resumed first, which stamps it.
  const a14 = v4 && revision >= A14;
  const allowed = ((v4 ? FIELDS4 : FIELDS)[kind] ?? []).filter((k) => a14 || !(FIELDS14[kind] ?? []).includes(k));
  const at14 = (k) => (v4 && !a14 && (FIELDS14[kind] ?? []).includes(k) ? `; ${k} is amendment 14's (skillRevision ${A14}): resume the run first` : '');
  const bad = Object.keys(e).filter((k) => !allowed.includes(k)).map((k) => `"${k}" isn't a field of a ${kind} entry (${allowed.join(', ')})${at14(k)}`);
  if (KINDS14.includes(kind) && !a14) return [`${kind} is amendment 14's (skillRevision ${A14}); this log is at ${revision ?? 'no skillRevision'}: resume it first (§25)`];
  if (kind === 'skeleton') {
    if (!CARD.test(String(e.concept))) bad.push(`concept ${show(e.concept)} isn't a card id r<round>-<letter>-<n>: the card whose skeleton file the runner removed (D-479)`);
    return bad;
  }
  if (kind === 'answer-change') {
    // D-480: the design gate's accept changed to the PoB file only, after F1 and before W1's entry.
    if (e.checkpoint !== 'design') bad.push(`checkpoint is ${show(e.checkpoint)}; an answer change amends a design checkpoint's accept (D-480)`);
    if (!isInt(e.visit, 1)) bad.push(`visit ${show(e.visit)} isn't a whole number from 1: the design gate visit whose answer changes`);
    if (e.from !== 'accept' || e.to !== 'accept:file') bad.push(`from ${show(e.from)} to ${show(e.to)}; an answer change is from "accept" to "accept:file", the guide to the PoB file only (D-480)`);
    if (!text(e.note)) bad.push("note is the user's words, a non-empty text");
    return bad;
  }
  if (kind === 'withdrawn') {
    if (!isId(e.build)) bad.push(`build ${show(e.build)} isn't a card id${idWords}`);
    if (!Array.isArray(e.files) || !e.files.every(text)) bad.push('files lists the paths pob2-render-audit <runFolder> --withdraw <card id> removed, relative to the run folder');
    return bad;
  }
  if (kind === 'stage') {
    const stages = Object.keys(OUTCOMES).filter((s) => v4 || !SCHEMA4_STAGES.includes(s));
    const outcomes = stages.includes(e.stage) ? OUTCOMES[e.stage] : undefined;
    if (!outcomes) return [...bad, `stage ${show(e.stage)} isn't one of ${stages.join(', ')}${SCHEMA4_STAGES.includes(e.stage) ? ` (${e.stage} is schema 4's: migrate the log first)` : ''}`];
    if (NO_CONCEPT.includes(e.stage) ? e.concept !== undefined : !isId(e.concept)) bad.push(NO_CONCEPT.includes(e.stage) ? `a ${e.stage} entry has no concept` : `concept ${show(e.concept)} isn't a card id r<round>-<letter>-<n>${idWords}`);
    // D-516 (Appendix A.6): a piece run's and a file run's steps are revision 16's.
    if (PIECE_STAGES.includes(e.stage) && !(revision >= A16)) bad.push(`${e.stage} is a piece run's or a file run's step, revision ${A16}'s (D-516); this log is at ${revision ?? 'no skillRevision'}`);
    if (!isInt(e.attempt, 1)) bad.push(`attempt ${show(e.attempt)} isn't a whole number from 1`);
    // D-421: in schema 4 any step the permission system refused is logged `refused`, then re-run alone, uncounted.
    const any = v4 ? ['missing', 'refused'] : ['missing'];
    if (![...outcomes, ...any].includes(e.outcome)) bad.push(`a ${e.stage} entry's outcome is ${[...outcomes, 'missing'].join(', ')}, not ${show(e.outcome)}`);
    // D-480: W1's `cancelled` is a log at 14's, and only after an answer change (writeLog holds it to the run).
    if (e.outcome === 'cancelled' && !a14) bad.push(`outcome cancelled is amendment 14's (skillRevision ${A14}): a W1 stopped by an answer change (D-480)`);
    // D-479: R1b's skeleton PoB file, or null when it wrote none.
    // R1b returns `skeleton: <relpath>`, or `skeleton: none: <the refusal's line>` when the draft write was refused, which
    // the runner logs as null; a failed attempt returns no skeleton line and logs none.
    if (e.skeletonFile !== undefined && (e.stage !== 'R1b' || !(e.skeletonFile === null || (text(e.skeletonFile) && /\.xml$/i.test(e.skeletonFile.trim()) && !/^none:/i.test(e.skeletonFile.trim()))))) bad.push('skeletonFile is only on R1b: the skeleton PoB file its draft write returned ("skeleton: <relpath>"), "<card name> skeleton (draft).xml", or null when the write was refused ("skeleton: none: <why>") (D-479)');
    // D-481, D-486, D-487: the scope narrows D1-finish (swap, scaling) and W1 (notes).
    // D-516 (revision 16): D1's four steps also take `better` and `ladder`.
    if (e.scope !== undefined && !scopesOf(e.stage, revision).includes(e.scope)) bad.push(`scope ${show(e.scope)} isn't one of ${e.stage}'s; ${[...new Set([...Object.keys(SCOPES), ...(revision >= A16 ? Object.keys(SCOPES16) : [])])].map((st) => `${st} takes ${scopesOf(st, revision).join(' or ')}`).join(', ')} (Appendix A${revision >= A16 ? ', D-516' : ''})`);
    // D-482: one result per request, the user's words verbatim.
    if (e.requests !== undefined) {
      if (!REQUEST_STAGES.includes(e.stage)) bad.push(`requests is only on ${REQUEST_STAGES.join(', ')}, the steps that take the user's requests (D-482)`);
      else if (!Array.isArray(e.requests) || e.requests.length === 0 || !e.requests.every((r) => isObj(r) && Object.keys(r).every((k) => ['id', 'words', 'result'].includes(k)) && text(r.id) && text(r.words) && REQUEST_RESULT.test(String(r.result)))) bad.push('requests is [{"id", "words", "result"}], one per request: its id, the user\'s words verbatim, and "made" or "departs: <how>" (D-482)');
    }
    if (e.priceOutcomes !== undefined) {
      const pricing = [...(a14 ? PRICING14 : PRICING), ...(revision >= A16 ? PIECE_PRICING : [])];
      if (!pricing.includes(e.stage)) bad.push(`priceOutcomes is only on ${pricing.join(', ')}`);
      else if (!isObj(e.priceOutcomes) || Object.entries(e.priceOutcomes).some(([k, v]) => !['ok', 'error', ...TRADE_KINDS, EXCHANGE, PACE].includes(k) || !isInt(v, 0))) bad.push('priceOutcomes counts calls by outcome: ok, error or a [trade:<kind>] kind, exchange for the calls priced from poe.ninja\'s currency exchange (D-444), and pace for the trade call whose reply had no pace line or the pace off (D-474), each a whole number');
    }
    if (e.stage === 'R1b' ? !isInt(e.probes, 0) : e.probes !== undefined) bad.push(e.stage === 'R1b' ? 'an R1b entry has probes, the probe variants it ran (0 when none)' : 'probes is only on R1b');
    if (ASSEMBLY_STAGES.includes(e.stage) ? e.shortReason !== undefined && !text(e.shortReason) : e.shortReason !== undefined) bad.push('shortReason is only on R1a-assemble and R1a-synthesize, a non-empty text');
    // D-408: a rival that found no faster structure says what it tried.
    if (e.stage === 'RV' && e.outcome === 'none-found' ? !text(e.tried) : e.tried !== undefined) bad.push('tried is on an RV entry whose outcome is none-found, and only there: what the rival tried, a non-empty text (D-408)');
  } else if (kind === 'checkpoint') {
    // D-482 (Appendix A): the ask checkpoint, a question asked outside a gate: a departure from the user's request, or
    // an open finding after the one re-check.
    if (a14 && e.checkpoint === 'ask') {
      if (!ASK_KINDS.includes(e.kind)) bad.push(`kind ${show(e.kind)} isn't one of ${ASK_KINDS.join(', ')} (D-482)`);
      if (!isId(e.build)) bad.push(`build ${show(e.build)} isn't a card id${idWords}: the build the question is about (D-482)`);
      for (const k of ['concept', 'questions', 'changes', 'newCards', 'note', 'scaling']) if (e[k] !== undefined) bad.push(`${k} isn't a field of an ask checkpoint (checkpoint, kind, build, visit, answer, answeredBy, rule)`);
      if (!isInt(e.visit, 1)) bad.push(`visit ${show(e.visit)} isn't a whole number from 1`);
      if (e.kind === 'open-finding' ? !OPEN_FINDING_ANSWERS.includes(e.answer) : !text(e.answer)) bad.push(e.kind === 'open-finding' ? `an open finding's answer is round (one more fix round and re-check, once a build) or ship (the issue goes in the PoB notes), not ${show(e.answer)} (D-482)` : "a departure's answer is the user's words, a non-empty text (D-482)");
      if (!['user', 'pre-supplied', 'default'].includes(e.answeredBy)) bad.push('answeredBy is user, pre-supplied or default');
      if (e.answeredBy === 'user' ? e.rule !== undefined : !text(e.rule)) bad.push(e.answeredBy === 'user' ? "a user's answer has no rule" : 'a pre-supplied or default answer has its rule');
      return bad;
    }
    if (e.kind !== undefined || e.build !== undefined) bad.push('kind and build are only on an ask checkpoint (D-482)');
    // D-486: the late endgame scaling answer rides on the design gate's accept.
    if (e.scaling !== undefined && !(e.checkpoint === 'design' && ['accept', 'accept:file'].includes(e.answer) && typeof e.scaling === 'boolean')) bad.push('scaling is true or false, only on the design gate\'s accept or accept:file: the answer to "late endgame scaling, yes or no?" (D-486)');
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
      if (per ? !isId(e.concept) : e.concept !== undefined) bad.push(per ? `a ${e.checkpoint} checkpoint names its build: concept, the card id r<round>-<letter>-<n>${idWords}, not ${show(e.concept)} (D-412)` : `concept is only on a design or final checkpoint (D-412)`);
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
    if (!isId(e.concept)) bad.push(`concept ${show(e.concept)} isn't a card id${idWords}`);
    if (!new RegExp(`^reports/gates/(D[12]-gate|F1)-(${CARD_ID}${v4 && opts.fileId === true ? `|${FILE_ID}` : ''})-a[1-9]\\d*\\.json$`).test(String(e.verdict)) || !String(e.verdict).startsWith(`reports/gates/${e.stage}-${e.concept}-a`)) bad.push("verdict is the escalated attempt's file, reports/gates/<stage>-<concept>-a<attempt>.json");
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
    // D-516 (Appendix A.6): a piece run's first write takes its piece and its source, and no slug or brief.
    if (v4 && e.piece !== undefined) bad.push(...pieceInitProblems(e));
    else {
      if (!text(e.slug)) bad.push('slug is the run folder\'s slug');
      if (!isObj(e.brief)) bad.push('brief is the parsed brief, {} for an empty one');
      // D-522 (§18): a run from a PoB file, its brief's from, has the slug file; better and campaign are its own.
      else if (v4) bad.push(...fileBriefProblems(e.slug, e.brief));
      if (e.source !== undefined) bad.push(`source is a piece run's (D-516); a /pob2:build-guide run's init takes slug and brief, and a piece run's init takes piece (${PIECES.join(', ')}) and source`);
    }
    if (!['offline', 'online'].includes(e.mode)) bad.push('mode is offline or online');
    if (!['none', 'accepted', 'refused'].includes(e.testConfig)) bad.push('testConfig is none, accepted or refused');
    if (e.status !== undefined && !['running', 'stopped'].includes(e.status)) bad.push('a first write\'s status is running, or stopped for a refused test config');
    // D-412, D-420: the run's --no-ninja, which every pricing step reads from the log.
    if (v4 && typeof e.noNinja !== 'boolean') bad.push('noNinja is true or false: whether the run prices without poe.ninja (--no-ninja, D-412)');
  } else if (kind === 'build') {
    // D-412: a finalized card's build, added queued with its card's identity; later writes change its status, its
    // guide (as the plan decides, D-414) or its PoB file (the final compile's record path).
    if (!isId(e.id)) bad.push(`id ${show(e.id)} isn't a card id r<round>-<letter>-<n>${idWords}`);
    if (e.roll !== undefined && !isRoll(e.roll)) bad.push("roll is the card's identity {className, ascendancy, skill} (D-286)");
    // D-435: the build's name, the card's or the one its finalize revision gave it; render-audit.mjs titles the audit with it.
    if (e.name !== undefined && !text(e.name)) bad.push("name is the build's name, the card's or the one its finalize revision gave it, a non-empty text (D-435)");
    if (e.status !== undefined && !BUILD_STATUSES.includes(e.status)) bad.push(`status is ${BUILD_STATUSES.join(', ')}`);
    if (e.guide !== undefined && !GUIDE_KINDS.includes(e.guide)) bad.push('guide is null, endgame or full (D-414)');
    if (e.pobFile !== undefined && e.pobFile !== null && !text(e.pobFile)) bad.push("pobFile is the final compile's PoB file path, or null");
    // D-466: the draft's one home, the path compile_plan's draft mode returned, null once F1 removed it.
    if (e.draftFile !== undefined && e.draftFile !== null && !text(e.draftFile)) bad.push("draftFile is the latest draft's path, as compile_plan's draft mode returned it, or null once F1 removed it (D-466)");
    if (Object.keys(e).length === 1 && e.id !== undefined) bad.push('a build entry changes its roll, name, status, guide, pobFile or draftFile');
  } else if (kind === 'resume') {
    if (typeof e.noNinja !== 'boolean') bad.push("noNinja is true or false: whether this session prices without poe.ninja (--no-ninja, D-415)");
  } else if (kind === 'pricing') {
    // D-444: the next gate asks "Pricing stopped at <step> after <outcome>: retry?" before its other questions.
    if (!DISPLAYED.includes(e.checkpoint)) bad.push(`checkpoint ${show(e.checkpoint)} isn't one of ${DISPLAYED.join(', ')}: the gate that asked whether to retry pricing (D-444)`);
    if (!RETRY_ANSWERS.includes(e.answer)) bad.push(`answer ${show(e.answer)} isn't ${RETRY_ANSWERS.join(' or ')} (D-444)`);
  }
  return bad;
}

/** D-516: a sha1 as `read.json` gives it, 40 lowercase hex digits. */
const SHA1 = /^[0-9a-f]{40}$/;
/** D-516: the longest name a piece run's `source` takes, a file name's; an import code never goes in the log. */
const SOURCE_NAME_MAX = 255;

/**
 * D-516 (Appendix A.6): a piece run's `init` entry, `{piece, mode, testConfig, noNinja, status?, source}` (its mode, test
 * config, status and noNinja checked as a pipeline run's): the piece one of the three, no `slug` or `brief`, and `source`
 * what the run started from, `{kind, name?, sha1?, build?}`: compile and
 * pricing a builds-folder file (`name`, its name) or an import code (no name: the code itself never goes in the log);
 * the writer a run folder (`name`, relative to the guides root, and `build`, its build's id when it has builds/).
 */
function pieceInitProblems(e) {
  const bad = [];
  if (!PIECES.includes(e.piece)) return [`piece ${show(e.piece)} isn't one of ${PIECES.join(', ')}: a piece run is /pob2:compile's, /pob2:pricing's or /pob2:writer's (D-516)`];
  for (const k of ['slug', 'brief']) if (e[k] !== undefined) bad.push(`${k} is a /pob2:build-guide run's; a piece run's log has no slug or brief: its folder is Guides/${e.piece}/<date>-<n>/, and source names what it started from (D-516, Appendix A.6)`);
  const kinds = PIECE_SOURCE_KINDS[e.piece];
  const src = e.source;
  if (!isObj(src)) return [...bad, `source is what the ${e.piece} run started from, {kind: ${kinds.map(show).join(' | ')}, …} (D-516, Appendix A.6)`];
  for (const k of Object.keys(src)) if (!SOURCE_FIELDS.includes(k)) bad.push(`source has "${k}", which isn't one of ${SOURCE_FIELDS.join(', ')}; an import code itself never goes in the log (D-516)`);
  if (!kinds.includes(src.kind)) bad.push(`source.kind is ${show(src.kind)}; a ${e.piece} run starts from ${kinds.map(show).join(' or ')} (D-516)`);
  const name = typeof src.name === 'string' ? src.name.trim() : '';
  if (src.kind === 'import-code') {
    if (src.name !== undefined) bad.push('source.name goes with a builds-folder file or a run folder; an import code is no name, and the code itself never goes in the log (D-516)');
  } else if (name === '' || src.name.length > SOURCE_NAME_MAX) bad.push(`source.name is ${src.name === undefined ? 'missing' : `${String(src.name).length > 80 ? `${String(src.name).slice(0, 77)}...` : show(src.name)}`}; ${src.kind === 'run-folder' ? "the source run folder, relative to the guides root (<slug>/<date>-<n>)" : "the builds-folder file's name"}, at most ${SOURCE_NAME_MAX} characters (D-516)`);
  if (src.kind === 'run-folder' && name !== '' && !/^[^\\/]+\/\d{4}-\d{2}-\d{2}-[1-9]\d*$/.test(name)) bad.push(`source.name is ${show(src.name)}; a run folder relative to the guides root, <slug>/<YYYY-MM-DD>-<n> (D-516)`);
  if (src.sha1 !== undefined && (src.kind === 'run-folder' || !SHA1.test(String(src.sha1)))) bad.push(src.kind === 'run-folder' ? "source.sha1 is a file's; a run folder has none (D-516)" : `source.sha1 is ${show(src.sha1)}; the file's sha1, 40 lowercase hex digits, as read.json gives it (D-516)`);
  if (src.build !== undefined && (src.kind !== 'run-folder' || !(CARD.test(String(src.build)) || src.build === FILE_ID))) bad.push(src.kind !== 'run-folder' ? "source.build is a run folder's build; a player's file has none (D-516)" : `source.build is ${show(src.build)}; the source build's id, a card id or ${FILE_ID} (D-516)`);
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
  // D-429: a composite deck holds its composites (a superseded one keeps its round line, still pickable) and every other card under `## Cards`.
  const held = new Set([...deck.entries.map((d) => d.id), ...deck.superseded.map((s) => s.old)]);
  const taken = new Map(deck.entries.filter((d) => text(d.name)).map((d) => [norm(d.name), d.id]));
  for (const c of earlier) if (text(c.name)) taken.set(norm(c.name), c.id);
  for (const id of listCards(runFolder)) {
    const name = parseCard(readText(runFolder, `cards/${id}.md`)).name;
    if (text(name)) taken.set(norm(name), id);
  }
  const keys = entry.newCards.some((c) => Array.isArray(c.from) && c.from.some((x) => KEY.test(String(x)))) ? pieceKeysOf(runFolder) : new Set();
  entry.newCards.forEach((c, i) => {
    n += 1;
    if (k === 0) bad.push(`newCards[${i}]: no brainstorm round has run, so there is no deck to draw on`);
    else if (c.id !== `r${k}-g-${n}`) bad.push(`newCards[${i}] has id ${show(c.id)}; the next card made at a gate is r${k}-g-${n}: round ${k} is the latest brainstorm round, and the run has made ${n - 1} gate card(s) in it (D-391)`);
    for (const id of c.from) {
      if (KEY.test(String(id))) {
        // D-432: a piece by its key, a Pieces row's key on a card of the run or an Ideas line's id in its research files.
        if (!keys.has(id)) bad.push(`newCards[${i}] draws on ${id}, which is no Pieces row's key on a card of the run and no Ideas line's id in its research files (D-432)`);
      } else if (!held.has(id)) bad.push(`newCards[${i}] draws on ${id}, which the deck (cards.md) doesn't hold (D-391)`);
    }
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
  if (schema !== 4 && ['build', 'resume', 'pricing'].includes(kind)) throw new Error(`${kind} entry refused: run-log.json is a schema-3 log; ${kind} is schema 4's (amendment 9): run pob2-run-log <runFolder> migrate first`);
  const problems = entryProblems(kind, entry, schema, existing === null ? SKILL_REVISION : revisionOf(existing), { fileId: existing !== null && takesFileId(existing) });
  if (problems.length > 0) throw new Error(`${kind} entry refused: ${problems.join('; ')}`);
  // D-516: a piece run's writes, held to its piece (Appendix A.6), and the steps and scopes of revision 16 in a pipeline run.
  const against16 = existing !== null && schema === 4 ? pieceAgainstRun(existing, kind, entry) : [];
  if (against16.length > 0) throw new Error(`${kind} entry refused: ${against16.join('; ')}`);
  let log;
  if (kind === 'init' && entry.piece !== undefined) {
    if (fs.existsSync(file)) throw new Error('run-log.json exists; init writes the first log only');
    // D-516 (Appendix A.6): a piece run's log, its fields in A.6's order: no slug, brief, dossier or builds.
    log = {
      schemaVersion: 4, skillRevision: SKILL_REVISION, piece: entry.piece, runFolder: path.resolve(runFolder), status: entry.status ?? 'running',
      mode: entry.mode, testConfig: entry.testConfig, noNinja: entry.noNinja, pinCommit: pinCommit(), digest: runningDigestNames(),
      source: Object.fromEntries(SOURCE_FIELDS.filter((k) => entry.source[k] !== undefined).map((k) => [k, entry.source[k]])),
      stages: [], checkpoints: [], displays: [], escalations: [], faults: [], resumes: [], pricing: { stops: [], retries: [] },
    };
  } else if (kind === 'init') {
    if (fs.existsSync(file)) throw new Error('run-log.json exists; init writes the first log only');
    // §19, amendment 12's §22: a new run is held to the current revision's rules from its start (no boundary); D-444: its
    // pricing stops and retries.
    log = {
      schemaVersion: 4, skillRevision: SKILL_REVISION, runFolder: path.resolve(runFolder), slug: entry.slug, brief: entry.brief, status: entry.status ?? 'running',
      mode: entry.mode, testConfig: entry.testConfig, noNinja: entry.noNinja, pinCommit: pinCommit(), digest: runningDigestNames(),
      dossier: null, builds: [], stages: [], checkpoints: [], displays: [], escalations: [], faults: [], resumes: [], pricing: { stops: [], retries: [] },
    };
  } else {
    log = existing;
    const expected = (Array.isArray(log.checkpoints) ? log.checkpoints.filter((c) => isObj(c) && c.checkpoint === entry.checkpoint).length : 0) + 1;
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && entry.visit !== expected) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s next visit is ${expected}, not ${entry.visit}`);
    }
    if (kind === 'checkpoint' && DISPLAYED.includes(entry.checkpoint) && !(Array.isArray(log.displays) && log.displays.some((d) => isObj(d) && d.checkpoint === entry.checkpoint && d.visit === entry.visit))) {
      throw new Error(`checkpoint entry refused: ${gateName(entry.checkpoint)}'s visit ${entry.visit} printed no display; run pob2-run-log <runFolder> display ${entry.checkpoint}${schema === 4 && ['design', 'final'].includes(entry.checkpoint) && typeof entry.concept === 'string' ? ` --build ${entry.concept}` : ''} first and print its output (D-367)`);
    }
    if (kind === 'checkpoint') {
      // D-516: a piece run has no builds[]; its design checkpoint names its one build, file (pieceAgainstRun).
      const against = [...newCardsAgainstRun(runFolder, log, entry), ...(schema === 4 && pieceOf(log) === null ? buildsAgainstRun(log, entry) : [])];
      if (against.length > 0) throw new Error(`checkpoint entry refused: ${against.join('; ')}`);
    }
    // D-429: a run keeps the coordinator step its first brainstorm round used, R1a-assemble or R1a-synthesize.
    const used = kind === 'stage' && ASSEMBLY_STAGES.includes(entry.stage) ? stagesOf(log).find((s) => ASSEMBLY_STAGES.includes(s.stage))?.stage : undefined;
    if (used !== undefined && used !== entry.stage) {
      throw new Error(`stage entry refused: this run's brainstorm rounds use ${used}, as its first round did; a run whose first round used R1a-assemble keeps it for every later round, and a run that composes keeps R1a-synthesize (D-429)`);
    }
    // D-443: a run held to amendment 11's rules runs no rival; an older run's RV entries stay readable.
    if (kind === 'stage' && entry.stage === 'RV' && revisionOf(log) >= A11) {
      throw new Error('stage entry refused: the rival (RV) is removed; a run held to amendment 11 (skillRevision 11 or later) never runs it, and only an older run\'s log keeps its RV entries (D-443)');
    }
    // D-452 (amendment 12, Appendix A): one tree per loadout, so D1-tree has no `respec` outcome in a log at 12; an older
    // run's respec entries stay readable.
    if (kind === 'stage' && entry.stage === 'D1-tree' && entry.outcome === 'respec' && revisionOf(log) >= 12) {
      throw new Error("stage entry refused: a run held to amendment 12 (skillRevision 12) has no respec: each loadout's tree is its own, so D1-tree never returns respec, and a user's respec request is a tree request, D1-tree then D1-finish (D-452)");
    }
    // Amendment 14 (Appendix A): the writes that change an entry or a list of their own, and the rules they hold the run to.
    const against14 = schema === 4 ? amendment14AgainstRun(log, kind, entry) : [];
    if (against14.length > 0) throw new Error(`${kind} entry refused: ${against14.join('; ')}`);
    if (kind === 'skeleton') {
      const r1b = stagesOf(log).filter((s) => s.stage === 'R1b' && s.concept === entry.concept && text(s.skeletonFile)).pop();
      r1b.skeletonRemoved = true;
      saveLog(file, log);
      return `stages[${log.stages.indexOf(r1b)}].skeletonRemoved (${entry.concept}'s skeleton file ${baseName(r1b.skeletonFile)})`;
    }
    if (kind === 'answer-change') {
      const c = objects(log.checkpoints).find((x) => x.checkpoint === 'design' && x.visit === entry.visit);
      if (!Array.isArray(log.answerChanges)) log.answerChanges = [];
      log.answerChanges.push({ checkpoint: entry.checkpoint, concept: c.concept, visit: entry.visit, from: entry.from, to: entry.to, note: entry.note, at: stagesOf(log).length });
      saveLog(file, log);
      return `answerChanges[${log.answerChanges.length - 1}] (${c.concept}: ${entry.from} to ${entry.to}, at stages[${stagesOf(log).length}])`;
    }
    if (kind === 'withdrawn') {
      if (!Array.isArray(log.withdrawals)) log.withdrawals = [];
      log.withdrawals.push({ build: entry.build, files: entry.files, at: stagesOf(log).length });
      saveLog(file, log);
      return `withdrawals[${log.withdrawals.length - 1}] (${entry.build}: ${entry.files.length > 0 ? entry.files.join(', ') : 'no file'})`;
    }
    const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
    const fields = (schema === 4 ? FIELDS4 : FIELDS)[kind];
    if (list) {
      if (!Array.isArray(log[list])) log[list] = [];
      const written = Object.fromEntries(fields.filter((k) => entry[k] !== undefined).map((k) => [k, entry[k]]));
      // D-482: an ask checkpoint records where it was asked, the stages[] length then.
      if (kind === 'checkpoint' && entry.checkpoint === 'ask') written.at = stagesOf(log).length;
      log[list].push(written);
      // D-444: a step that hit a rate limit or a lockout stops trade-site pricing until a gate's retry-pricing (or a resume).
      const stop = kind === 'stage' && revisionOf(log) >= A11 ? stopOutcome(entry.priceOutcomes) : null;
      if (stop !== null) {
        if (!isObj(log.pricing)) log.pricing = { stops: [], retries: [] };
        if (!Array.isArray(log.pricing.stops)) log.pricing.stops = [];
        log.pricing.stops.push({ at: log.stages.length - 1, step: entry.stage, outcome: stop });
        saveLog(file, log);
        // D-516: a piece run has no gate that asks to retry, so a stop ends it, and a resume after the lockout is the retry.
        if (pieceOf(log) !== null) return `stages[${log.stages.length - 1}], and pricing.stops[${log.pricing.stops.length - 1}]: trade-site pricing stopped after ${stop}, which ends this ${log.piece} run: ask the user for the rung first when none is placed, set the status stopped, tell the user when the lockout ends, and stop; /pob2:${log.piece} --resume <run folder> after it is the retry (D-516)`;
        return `stages[${log.stages.length - 1}], and pricing.stops[${log.pricing.stops.length - 1}]: trade-site pricing stopped after ${stop} until a gate's retry-pricing (D-444)`;
      }
    } else if (kind === 'pricing') {
      const why = pricingAgainstRun(log, entry);
      if (why.length > 0) throw new Error(`pricing entry refused: ${why.join('; ')}`);
      if (!Array.isArray(log.pricing.retries)) log.pricing.retries = [];
      log.pricing.retries.push({ checkpoint: entry.checkpoint, answer: entry.answer, at: Array.isArray(log.stages) ? log.stages.length : 0 });
      saveLog(file, log);
      return `pricing.retries[${log.pricing.retries.length - 1}] (${entry.answer} at the ${entry.checkpoint} gate)`;
    } else if (kind === 'build') {
      saveLog(file, upsertBuild(log, entry));
      return `builds[${log.builds.findIndex((b) => b.id === entry.id)}]`;
    } else if (kind === 'resume') {
      if (!Array.isArray(log.resumes)) log.resumes = [];
      log.resumes.push(resumeEntry(log, entry.noNinja));
      // D-415, D-420: the top-level noNinja is the current session's, which every pricing step reads; each resumes[]
      // entry keeps its own session's record (a migrated run's null, or init's flag, is replaced here).
      log.noNinja = entry.noNinja;
      log.status = 'running';
      // §19, Appendix A (amendment 12): a resume stamps an older log with the skill revision, and writes a boundary, the
      // lists' lengths where that revision's rules start, for every revision above the log's old one; the boundaries it
      // had stay (a revision-11 log's flat one read as 11's).
      const old = revisionOf(log);
      const added = REVISIONS.filter((r) => old === null || r > old);
      const stamped = added.length > 0;
      if (stamped) {
        const lengths = log.resumes[log.resumes.length - 1].lengths;
        const from = { ...boundariesOf(log) };
        for (const r of added) from[String(r)] = { ...lengths };
        log.skillRevision = SKILL_REVISION;
        log.skillRevisionFrom = from;
      }
      if (!isObj(log.pricing)) log.pricing = { stops: [], retries: [] };
      saveLog(file, log);
      const at = stamped ? log.skillRevisionFrom[String(SKILL_REVISION)].stages : null;
      // Revision 15 is amendment 16's (M-29), so the stamp names revisions, not amendments.
      return `resumes[${log.resumes.length - 1}], status running${stamped ? `, skillRevision ${SKILL_REVISION} from stages[${at}]${added.length > 1 ? ` (the rules of revisions ${added.slice(0, -1).join(', ')} and ${added[added.length - 1]})` : ''}` : ''}`;
    } else Object.assign(log, entry);
  }
  saveLog(file, log);
  const list = { stage: 'stages', checkpoint: 'checkpoints', escalation: 'escalations' }[kind];
  return list ? `${list}[${log[list].length - 1}]` : kind === 'init' ? 'the first log' : Object.keys(entry).join(', ');
}

/**
 * D-522 (§18): a file run's gates. It has no brainstorm or verification gate: the file is the skeleton, and its card the
 * file card. Its design gate takes no `verification`, nor its escalation, nor its final gate `accept:verification`; the
 * better round's design gate (its last D1 gate's scope `better`) takes accept (the result placed again, then the ladder),
 * revise:<text> or stop, with no scaling question.
 */
function fileRunGates(log, kind, entry) {
  const bad = [];
  const which = kind === 'checkpoint' ? entry.checkpoint : kind === 'escalation' ? 'escalation' : null;
  if (which === null) return bad;
  if (['brainstorm', 'verification'].includes(which)) return [`a run from a PoB file has no ${which} gate: the file is its skeleton and cards/${FILE_ID}.md its card (D-522)`];
  if ((which === 'design' && entry.answer === 'verification') || (kind === 'escalation' && entry.choice === 'verification') || (which === 'escalation' && entry.answer === 'verification') || (which === 'final' && entry.answer === 'accept:verification')) {
    return [`a run from a PoB file has no verification gate to go back to: its ${which === 'final' ? 'final gate takes accept, campaign, revise:<text> or decline:<note>' : which === 'design' ? 'design gate takes accept, accept:file, revise:<text> or stop' : 'escalation takes accept, retry or stop'} (D-522)`];
  }
  const lastGate = objects(log.stages).filter((x) => x.stage === 'D1-gate' && x.outcome !== 'missing').pop();
  if (which === 'design' && lastGate?.scope === 'better' && (!/^(?:accept|revise:.+|stop)$/s.test(String(entry.answer)) || entry.scaling !== undefined)) {
    bad.push(`answer ${show(entry.answer)}${entry.scaling !== undefined ? ` with scaling ${show(entry.scaling)}` : ''}: the better round's design gate takes accept (the result placed again, then the ladder around it), revise:<text> or stop, and asks no scaling question (D-521, D-522)`);
  }
  return bad;
}

/**
 * D-516 (Appendix A.6): a write against a piece run, and revision 16's steps and scopes against a pipeline run. A piece run
 * logs only its piece's steps; its checkpoints are the compile run's better round's design gate and escalation question,
 * naming its one build `file`, as its escalations do; it has no `build` entry, no gate's `pricing` answer (a stop ends it,
 * and the resume is the retry) and no `dossier`. In a pipeline run, `read`, `measure` and `place` are a file run's only
 * (slug `file`), and `price` is the pricing piece's; the scope `better` is a compile run's or a file run's, `ladder` a file
 * run's.
 */
function pieceAgainstRun(log, kind, entry) {
  const piece = pieceOf(log);
  const bad = [];
  if (piece === null) {
    if (kind === 'escalation' && entry.draftFile !== undefined) bad.push("draftFile is a compile run's escalation's (D-521); a /pob2:build-guide build's draft goes in builds[].draftFile (D-466)");
    if (kind === 'stage' && PIECE_STAGES.includes(entry.stage)) {
      if (entry.stage === 'price') bad.push(`price is /pob2:pricing's step; a /pob2:build-guide run prices inside its own steps (D-516, Appendix A.6)`);
      else if (!isFileRun(log)) bad.push(`${entry.stage} is a file run's step (/pob2:build-guide from a PoB file, slug ${FILE_ID}) or a piece run's; this run's slug is ${show(log.slug)} (D-516)`);
    }
    if (kind === 'stage' && ['better', 'ladder'].includes(entry.scope) && !isFileRun(log)) bad.push(`scope ${entry.scope} is ${entry.scope === 'better' ? "the better round's, a compile run's or a file run's" : "a file run's rungs around the placed one"}; this run's slug is ${show(log.slug)} (D-516)`);
    if (isFileRun(log)) bad.push(...fileRunGates(log, kind, entry));
    return bad;
  }
  const steps = PIECE_STEPS[piece];
  if (kind === 'stage') {
    if (!steps.includes(entry.stage)) bad.push(`${entry.stage} isn't a ${piece} run's step; a ${piece} run logs ${steps.join(', ')} (D-516, Appendix A.6)`);
    if (entry.scope === 'ladder') bad.push(`scope ladder is a file run's (/pob2:build-guide from a PoB file); a ${piece} run designs no ladder (D-516)`);
    if (piece === 'compile' && entry.concept !== undefined && entry.concept !== FILE_ID) bad.push(`concept ${show(entry.concept)}: a compile run's one build is ${FILE_ID} (D-516)`);
    // D-516 (§18): a writer run's W1 writes the guide of its source's build: source.build, or file for a root build.
    const want = isObj(log.source) && text(log.source.build) ? log.source.build : FILE_ID;
    if (piece === 'writer' && entry.stage === 'W1' && entry.concept !== want) bad.push(`concept ${show(entry.concept)}: a writer run's W1 writes the guide of its source's build, ${want} (source.build, else ${FILE_ID}; D-516)`);
  } else if (kind === 'checkpoint' || kind === 'escalation') {
    const which = kind === 'checkpoint' ? entry.checkpoint : 'escalation';
    // D-482: the better round's D1 steps take the user's requests, so its runner may ask about a departure (`ask`).
    if (piece !== 'compile' || !['design', 'escalation', 'ask'].includes(which)) bad.push(`a ${piece} run has no ${which === 'escalation' ? 'escalation' : which === 'ask' ? 'ask checkpoint' : `${which} gate`}; only a compile run's better round has gates, its design gate and its escalation question, and its ask (D-516)`);
    else if (kind === 'checkpoint' && which === 'design' && entry.concept !== FILE_ID) bad.push(`concept ${show(entry.concept)}: a compile run's design checkpoint names its one build, ${FILE_ID} (D-516)`);
    else if (kind === 'checkpoint' && which === 'ask' && entry.build !== FILE_ID) bad.push(`build ${show(entry.build)}: a compile run's ask names its one build, ${FILE_ID} (D-516)`);
    else if (kind === 'escalation' && entry.concept !== FILE_ID) bad.push(`concept ${show(entry.concept)}: a compile run's escalation names its one build, ${FILE_ID} (D-516)`);
    // D-521 (§17): the better round's design gate takes accept (F1 writes the final PoB file), revise:<text> or stop, and
    // asks no scaling question; its escalation has no verification gate to go back to.
    else if (kind === 'checkpoint' && which === 'design' && (!/^(?:accept|revise:.+|stop)$/s.test(String(entry.answer)) || entry.scaling !== undefined)) bad.push(`answer ${show(entry.answer)}${entry.scaling !== undefined ? ` with scaling ${show(entry.scaling)}` : ''}: a compile run's design gate takes accept (F1 writes the final PoB file), revise:<text> or stop, and asks no scaling question (D-521)`);
    else if ((kind === 'checkpoint' && which === 'escalation' && entry.answer === 'verification') || (kind === 'escalation' && entry.choice === 'verification')) bad.push('a compile run has no verification gate: its escalation takes accept, retry:<guidance> or stop (D-521)');
    else if (kind === 'escalation' && entry.draftFile !== undefined && !(entry.stage === 'D1-gate' && entry.choice === 'accept' && text(entry.draftFile))) bad.push(`draftFile ${show(entry.draftFile)}: the draft the runner wrote after the D1 gate's escalation was accepted, its path in the builds folder, on that entry only (D-521)`);
  } else if (kind === 'pricing') {
    bad.push(`a ${piece} run has no gate that asks to retry pricing: a stop ends the run (status stopped), and /pob2:${piece} --resume <run folder> after the lockout is the retry, which clears the stop (D-516)`);
  } else if (kind === 'build') {
    bad.push(`a ${piece} run has no builds[]: its files sit at the folder's root, its one build's (D-516, Appendix A.6)`);
  } else if (kind === 'set' && entry.dossier !== undefined) {
    bad.push(`a ${piece} run has no dossier (D-516, Appendix A.6)`);
  }
  return bad;
}

/**
 * Amendment 14 (D-479, D-480, D-482; Appendix A): a write against the run: a skeleton removed is a picked card's (a build
 * of the run) whose last R1b recorded the file and no removal yet; an answer change amends a design visit answered
 * `accept`, after its build's F1 passed and before any W1 entry after that pass, once; W1's `cancelled` follows an answer
 * change for its build, with no W1 after it; an ask checkpoint names a build of the run; a withdrawal follows an answer
 * change for its build.
 */
function amendment14AgainstRun(log, kind, entry) {
  const bad = [];
  const stages = stagesOf(log);
  const builds = objects(log.builds);
  const real = (s) => !['missing', 'refused'].includes(s.outcome);
  const changes = objects(log.answerChanges);
  if (kind === 'skeleton') {
    const r1b = stages.filter((s) => s.stage === 'R1b' && s.concept === entry.concept && text(s.skeletonFile)).pop();
    if (!r1b) bad.push(`no R1b entry for ${entry.concept} records a skeleton file (skeletonFile); R1b returns skeleton: <relpath> and the runner logs it (D-479)`);
    else if (r1b.skeletonRemoved === true) bad.push(`${entry.concept}'s skeleton file ${baseName(r1b.skeletonFile)} is already removed`);
    if (!builds.some((b) => b.id === entry.concept)) bad.push(`${entry.concept} has no build in the run; only a picked card's skeleton is removed, when its build gets its first design draft, and an unpicked card's stays (D-479)`);
  } else if (kind === 'answer-change') {
    const c = objects(log.checkpoints).find((x) => x.checkpoint === 'design' && x.visit === entry.visit);
    if (!c) return [`the design gate has no visit ${entry.visit} in checkpoints[]`];
    if (c.answer !== entry.from) bad.push(`design visit ${entry.visit} was answered ${show(c.answer)}, not ${show(entry.from)}; an answer change amends the accept the visit logged (D-480)`);
    if (changes.some((x) => x.checkpoint === 'design' && x.visit === entry.visit)) bad.push(`design visit ${entry.visit}'s answer was already changed`);
    const f1 = stages.map((s, i) => ({ s, i })).filter(({ s }) => s.stage === 'F1' && s.concept === c.concept && real(s)).pop();
    if (!f1 || f1.s.outcome !== 'pass') bad.push(`${c.concept}'s F1 hasn't passed; the answer changes after F1's pass and before W1's entry (D-480)`);
    else if (stages.slice(f1.i + 1).some((s) => s.stage === 'W1' && s.concept === c.concept && real(s))) bad.push(`${c.concept}'s W1 entry is recorded after its F1 pass; the answer changes before W1's entry, and a W1 still running is logged cancelled after it (D-480)`);
  } else if (kind === 'stage' && entry.outcome === 'cancelled') {
    const change = changes.filter((x) => x.concept === entry.concept).pop();
    if (!change) bad.push(`${entry.concept} has no answer change; W1 is cancelled only when the user changed the design gate's accept to the PoB file only after F1 (D-480)`);
    else if (stages.slice(change.at).some((s) => s.stage === 'W1' && s.concept === entry.concept && real(s))) bad.push(`${entry.concept}'s W1 after its answer change is already logged; one W1 is cancelled, the one running when the answer changed (D-480)`);
  } else if (kind === 'checkpoint' && entry.checkpoint === 'ask') {
    // D-516: a piece run has no builds[]; its ask names its one build, file (pieceAgainstRun).
    if (pieceOf(log) === null && !builds.some((b) => b.id === entry.build)) bad.push(`build ${entry.build} has no build in the run; builds[] holds ${builds.map((b) => b.id).join(', ') || 'none'} (D-482)`);
    const next = objects(log.checkpoints).filter((c) => c.checkpoint === 'ask').length + 1;
    if (entry.visit !== next) bad.push(`the next ask is visit ${next}, not ${entry.visit}`);
  } else if (kind === 'withdrawn') {
    if (!changes.some((x) => x.concept === entry.build)) bad.push(`${entry.build} has no answer change; pob2-render-audit <runFolder> --withdraw <card id> removes the guide route's files of a build whose answer changed to the PoB file only (D-480)`);
  }
  return bad;
}

/** D-444: the stop a step's `priceOutcomes` holds: `locked_out` when it counts one, else `rate_limited`, else null. */
export function stopOutcome(priceOutcomes) {
  if (!isObj(priceOutcomes)) return null;
  const hit = STOP_OUTCOMES.filter((k) => isInt(priceOutcomes[k], 1));
  return hit.includes('locked_out') ? 'locked_out' : hit.length > 0 ? hit[0] : null;
}

/**
 * Appendix A (amendment 12): a log's boundaries by revision, `{"11": {stages, checkpoints, escalations, displays}, "12":
 * {…}}`, each the lists' lengths where a resume stamped that revision. A revision-11 log's flat `skillRevisionFrom`
 * (`{stages, …}`, amendment 11's form) reads as `{"11": …}`; a log without one has none.
 */
export function boundariesOf(log) {
  const f = isObj(log) ? log.skillRevisionFrom : undefined;
  if (!isObj(f)) return {};
  return Object.keys(f).every((k) => /^[1-9]\d*$/.test(k)) ? f : { [String(A11)]: f };
}

/**
 * §19, amendment 12's §22: where a log's entries start being held to `revision`'s rules (amendment 11's by default), as
 * an index into `list` (stages[] by default). Revisions compare by order: a log at `revision` or later is held from that
 * revision's boundary when a resume stamped it, and from 0 when `init` wrote it (no boundary); a log below `revision`, or
 * without `skillRevision`, is never held to it (Infinity).
 */
export function heldFrom(log, list = 'stages', revision = A11) {
  const r = revisionOf(log);
  if (r === null || r < revision) return Infinity;
  const b = boundariesOf(log)[String(revision)];
  return isObj(b) && isInt(b[list], 0) ? b[list] : 0;
}
/** §19: whether a log is held to amendment 11's rules from some entry on (it has `skillRevision`). */
export const held = (log) => heldFrom(log) !== Infinity;

/**
 * D-444: the open stop at stages[] index `i` (the pricing state a step logged at `i` saw): the last stop before `i`
 * that no `retry-pricing` answer and no resume came after (before `i`); null when pricing isn't stopped.
 */
export function openStop(log, i) {
  const stops = objects(log?.pricing?.stops).filter((x) => isInt(x.at, 0) && x.at < i);
  const last = stops[stops.length - 1];
  if (!last) return null;
  const retried = objects(log.pricing.retries).some((r) => r.answer === 'retry-pricing' && isInt(r.at, 0) && r.at > last.at && r.at <= i);
  const resumed = objects(log.resumes).some((r) => isInt(r.lengths?.stages, 0) && r.lengths.stages > last.at && r.lengths.stages <= i);
  return retried || resumed ? null : last;
}

/**
 * D-444: a gate's pricing answer is asked only after a stop: the log holds an open stop, and the gate visit it asks at
 * has printed its display.
 */
function pricingAgainstRun(log, entry) {
  const bad = [];
  if (!(revisionOf(log) >= A11)) bad.push('pricing stops and retries are amendment 11\'s (skillRevision 11 or later); this log is an older run\'s: resume it first (§19)');
  const at = Array.isArray(log.stages) ? log.stages.length : 0;
  if (openStop(log, at) === null) bad.push(`no stop is open: the gate asks whether to retry pricing only after a step hit a rate limit or a lockout (pricing.stops[]), and before a retry-pricing answer or a resume cleared it (D-444)`);
  const visit = objects(log.checkpoints).filter((c) => c.checkpoint === entry.checkpoint).length + 1;
  if (!objects(log.displays).some((d) => d.checkpoint === entry.checkpoint && d.visit === visit)) bad.push(`${gateName(entry.checkpoint)}'s visit ${visit} printed no display; the gate asks its pricing question after its display, before its other questions (D-444)`);
  return bad;
}

/**
 * D-412: adds a finalized card's build (`{id, roll, status: "queued"}`: its folder `builds/<id>`, no guide, no PoB file
 * yet), or changes an existing build's status, guide or PoB file. A card that has a build is never finalized again
 * (D-411), and its identity never changes. Returns the log; throws an Error saying why not.
 */
function upsertBuild(log, entry) {
  if (!Array.isArray(log.builds)) log.builds = [];
  const at = log.builds.findIndex((b) => isObj(b) && b.id === entry.id);
  // D-466 (Appendix A): `draftFile` is a log at 13's; an older log is resumed first, which stamps it.
  const a13 = revisionOf(log) >= A13;
  if (entry.draftFile !== undefined && !a13) throw new Error(`build entry refused: draftFile is amendment 13's (skillRevision ${A13}); this log is at ${revisionOf(log) ?? 'no skillRevision'}: resume it first (D-466, §22)`);
  /** A build's fields in order; `name` only once an entry gave one (D-435); `draftFile` after `pobFile` on a log at 13 (D-466). */
  const shaped = (b) => Object.fromEntries([...(text(b.name) ? BUILD_FIELDS_NAMED : BUILD_FIELDS), ...(a13 ? ['draftFile'] : [])].map((k) => [k, b[k] ?? null]));
  if (at < 0) {
    if (entry.roll === undefined || entry.status !== 'queued') throw new Error(`build entry refused: ${entry.id} has no build yet; a new build is {"id", "roll", "status": "queued"}, with "name" when its finalize revision gave the build one, added when the verification gate finalizes its card (D-411, D-412, D-435)`);
    log.builds.push(shaped({ id: entry.id, roll: entry.roll, name: entry.name, status: 'queued', folder: `builds/${entry.id}`, guide: entry.guide ?? null, pobFile: entry.pobFile ?? null, draftFile: entry.draftFile ?? null }));
    return log;
  }
  const b = log.builds[at];
  if (entry.roll !== undefined && JSON.stringify(entry.roll) !== JSON.stringify(b.roll)) throw new Error(`build entry refused: ${entry.id}'s identity is ${JSON.stringify(b.roll)}; a build keeps its card's identity (D-286)`);
  if (entry.status === 'queued' && b.status !== 'queued') throw new Error(`build entry refused: ${entry.id} already has a build (${b.status}); a card with a build in the run isn't finalized again: revise it at its design gate, or make a new card from it (D-411)`);
  for (const k of ['name', 'status', 'guide', 'pobFile', 'draftFile']) if (entry[k] !== undefined) b[k] = entry[k];
  log.builds[at] = shaped(b);
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
 * D-507 (amendment 16 §3): the instant the league rule reads, once per process: the machine's clock, or the test
 * clock `BUILD_GUIDE_TEST_NOW` (an instant as `leagues.mjs --at` reads one), which only tests set.
 */
let nowAt;
export function leagueNow() {
  if (nowAt === undefined) {
    const at = process.env.BUILD_GUIDE_TEST_NOW;
    nowAt = at === undefined || at === '' ? Date.now() : instantOf(at);
    if (!Number.isFinite(nowAt)) throw new Error(`BUILD_GUIDE_TEST_NOW is "${at}", which isn't an instant (2026-12-11T19:59Z)`);
  }
  return nowAt;
}

/** The committed league digests' folder, `data/league/` at the plugin root. */
const leagueFolder = (repo = REPO) => path.join(repo, 'data', 'league');

/**
 * D-507: the running leagues' digests, as the run log records them from revision 15: their file names, the latest start
 * first, then by name (`runningDigests`, C-59), possibly empty.
 */
export function runningDigestNames(repo = REPO, now = leagueNow()) {
  return runningDigests([leagueFolder(repo)], now).map((d) => d.name);
}

/** D-507: what `init` and `resume` print after their first line, for the runner to copy (`leagues.mjs`'s report). */
export function digestReport(repo = REPO, now = leagueNow()) {
  return leagueReport([leagueFolder(repo)], now, repo);
}

/** Today's date, YYYY-MM-DD, in local time. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * D-415: a resume's entry, `{date, pinCommit, digest, noNinja, lengths}`: the session's date, the pin's commit and the
 * running leagues' digests (D-507) as the repository and the clock give them now, the session's --no-ninja, and the
 * lengths of `stages[]`, `checkpoints[]`, `escalations[]` and `displays[]` at the resume, so every entry after it can be
 * placed.
 */
function resumeEntry(log, noNinja) {
  const n = (k) => (Array.isArray(log[k]) ? log[k].length : 0);
  return { date: today(), pinCommit: pinCommit(), digest: runningDigestNames(), noNinja, lengths: { stages: n('stages'), checkpoints: n('checkpoints'), escalations: n('escalations'), displays: n('displays') } };
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
// The test config (D-394; skills/build-guide/references/offline-and-test.md)
// ---------------------------------------------------------------------------------------------------

const CONFIG_GATES = ['brainstorm', 'verification', 'design', 'final', 'escalation'];
const ENTRY_FIELDS = ['ask', 'answer', 'changes', 'newCards', 'note', 'scaling'];
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
  // D-486 (amendment 14): a design accept may answer the late endgame scaling question; false when it doesn't.
  if (entry.scaling !== undefined && !(gate === 'design' && ['accept', 'accept:file'].includes(entry.answer) && typeof entry.scaling === 'boolean')) bad.push('scaling is true or false, only on a design answer of accept or accept:file (D-486)');
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
/**
 * A composite deck's H2s (D-429, D-432; Appendix A): the header, one `Round <k>` per round R1a-synthesize composed, the
 * footer, then `Superseded` only when a later round recomposed.
 */
export const COMPOSITE_HEADER = ['What the composites share', 'How they differ', 'The obvious build'];
export const COMPOSITE_FOOTER = ['Cards', 'Pieces not used', 'Not composed'];
export const SUPERSEDED = 'Superseded';
/** A composite card's two tables (D-433; Appendix A): `### Pieces` in its brainstorm half, `### Pieces measured` in its verification half. */
export const PIECES_COLUMNS = ['Key', 'Piece', 'Kind', 'Status', 'Where', 'Why', 'From'];
export const MEASURED_COLUMNS = ['Key', 'Drops', 'How'];
/**
 * D-436 (amendment 11, Appendix A): the Pieces measured table of a card verified under amendment 11's rules: each
 * piece's key, how the probe left it out, and whether it does something: `yes` (leaving it out moves one of its
 * figures by 1% or more), `no`, `PoB can't see it` or `not measured (<why>)`; `in` rows only.
 */
export const MEASURED_COLUMNS_A11 = ['Key', 'Left out by', 'Does something'];
/** D-436: the answers of a Pieces measured row under amendment 11. */
export const DOES_SOMETHING = /^(?:yes|no|PoB can['’]t see it|not measured \(.+\))$/;
/**
 * A piece's kind (Appendix A), and its status in a composite: in, scheduled (its own button, set or setup), or out (D-429).
 * D-474 (amendment 13): `anoint`, a notable the amulet allocates.
 */
export const PIECE_KINDS = ['skill', 'support', 'unique', 'mod', 'node', 'keystone', 'rune', 'config', 'anoint'];
export const PIECE_STATUSES = ['in', 'scheduled', 'out'];
/** The mark on a gate-made card's deck line (D-391). */
export const MADE_MARK = 'made at the gate';
/** D-406: the structure check's optional last line, `- A stronger structure? <the flip, and the rough multiplier>`. */
export const STRONGER = 'A stronger structure?';
/** D-429: what each H3 of a composite's verification half holds until R1b writes it. */
export const NOT_CHECKED = 'Not checked yet.';

/**
 * D-406: a card's `### Structure check`, in its verification half: its top-level items `- <text>` (indented lines
 * joined to them) with their line numbers, the H2 it sits under, and its stronger-structure line `- A stronger
 * structure? <text>` (`stronger`, the text after the question mark; `strongerLast`, whether it is the section's last
 * item), and `checked`, whether it holds more than `Not checked yet.` (D-429: a composite counts as verified then). Null
 * when the card has no such heading.
 */
function structureCheck(lines) {
  const at = lines.findIndex((l) => /^###\s+Structure check\s*$/.test(l));
  if (at < 0) return null;
  const h2 = lines.slice(0, at).filter((l) => /^##\s/.test(l)).pop()?.replace(/^##\s+/, '').trim() ?? null;
  const items = [];
  const body = [];
  for (let i = at + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i += 1) {
    const l = lines[i];
    if (l.trim() !== '') body.push(l.trim());
    const item = /^[-*]\s+(.*)$/.exec(l);
    if (item) items.push({ text: item[1].trim(), line: i + 1 });
    else if (items.length > 0 && /^\s+\S/.test(l)) items[items.length - 1].text += ` ${l.trim().replace(/^[-*]\s+/, '')}`;
  }
  const k = items.findIndex((x) => x.text.startsWith(STRONGER));
  return {
    line: at + 1, h2, items,
    // D-429: R1a-synthesize writes a composite's verification half with each H3 holding `Not checked yet.`; the card is
    // verified once its structure check holds more than that.
    checked: body.some((l) => l !== NOT_CHECKED),
    stronger: k < 0 ? null : items[k].text.slice(STRONGER.length).trim(),
    strongerLine: k < 0 ? null : items[k].line,
    strongerLast: k < 0 || k === items.length - 1,
  };
}

/** A table cell that says nothing: blank, or a dash (`—`, `-`). */
export const emptyCell = (c) => /^[-\u2010-\u2015\u2212]*$/.test(String(c ?? '').trim());

/**
 * D-433, Appendix A: the table under a card's H3 `### <title>` (`Pieces` or `Pieces measured`): `{line, h2, header,
 * ruled, rows, pending}`, `h2` the H2 it sits under, `header` the first row's cells, `ruled` whether a `|---|` row
 * follows it, `rows` the rest, each `{cells, line, field(column)}`, and `pending` when the heading holds only `Not
 * checked yet.` (D-429). Null when the card has no such heading.
 */
function tableUnder(lines, title, columns) {
  const at = lines.findIndex((l) => new RegExp(`^###\\s+${title}\\s*$`).test(l));
  if (at < 0) return null;
  const h2 = lines.slice(0, at).filter((l) => /^##\s/.test(l)).pop()?.replace(/^##\s+/, '').trim() ?? null;
  let i = at + 1;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  // D-429: a heading R1b hasn't written yet holds only `Not checked yet.`.
  const pending = lines[i]?.trim() === NOT_CHECKED;
  const rows = [];
  for (; i < lines.length && lines[i].trim().startsWith('|'); i += 1) {
    rows.push({ cells: lines[i].trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()), line: i + 1 });
  }
  const header = rows[0]?.cells ?? [];
  const ruled = rows.length > 1 && rows[1].cells.every((c) => /^:?-+:?$/.test(c));
  const body = rows.slice(ruled ? 2 : 1).map((r) => ({ ...r, field: (col) => r.cells[columns.indexOf(col)] ?? '' }));
  return { line: at + 1, h2, header, ruled, rows: body, pending };
}

/**
 * A composite's Pieces table (D-429, Appendix A): each row `{key, piece, kind, underPlayed, status, where, why, from,
 * line, cells}`, `underPlayed` when its Kind carries `, under-played`. Null when the card has no `### Pieces`.
 */
function piecesTable(lines) {
  const t = tableUnder(lines, 'Pieces', PIECES_COLUMNS);
  if (t === null) return null;
  return {
    ...t,
    rows: t.rows.map((r) => ({
      key: r.field('Key'), piece: r.field('Piece'), kind: r.field('Kind'), underPlayed: /,\s*under-played\s*$/i.test(r.field('Kind')),
      status: r.field('Status'), where: r.field('Where'), why: r.field('Why'), from: r.field('From'), line: r.line, cells: r.cells,
    })),
  };
}

/**
 * A composite's Pieces measured table (D-433, Appendix A), read by its header (§19): amendment 10's `Key | Drops | How`,
 * each row `{key, drops, how, line, cells}`, or amendment 11's `Key | Left out by | Does something` (`a11` true), each
 * row `{key, leftOutBy, answer, line, cells}`; null without it.
 */
function measuredTable(lines) {
  const t = tableUnder(lines, 'Pieces measured', MEASURED_COLUMNS);
  if (t === null) return null;
  if (JSON.stringify(t.header) === JSON.stringify(MEASURED_COLUMNS_A11)) {
    const at = (r, col) => r.cells[MEASURED_COLUMNS_A11.indexOf(col)] ?? '';
    return { ...t, a11: true, rows: t.rows.map((r) => ({ key: at(r, 'Key'), leftOutBy: at(r, 'Left out by'), answer: at(r, 'Does something'), line: r.line, cells: r.cells })) };
  }
  return { ...t, a11: false, rows: t.rows.map((r) => ({ key: r.field('Key'), drops: r.field('Drops'), how: r.field('How'), line: r.line, cells: r.cells })) };
}

/** D-445: every published guide a card draws on, its `external | <url>` marker's URLs, in order, once each. */
function externalSources(text) {
  const urls = [...String(text).matchAll(/\bexternal\s*\|\s*(https?:\/\/[^\s|)\]]+)/g)].map((m) => m[1]);
  return [...new Set(urls)];
}

/** The detail of a card's checklist row 4, "Risks PoB can't show" (R1b's checklist), or null. */
function cantShow(lines) {
  const t = tableUnder(lines, 'Checklist results', ['#', 'Check', 'Result', 'Detail']);
  const row = t?.rows.find((r) => r.field('#') === '4');
  const detail = row?.field('Detail');
  return typeof detail === 'string' && !emptyCell(detail) && !/^not checked$/i.test(row.field('Result')) ? detail : null;
}

/**
 * D-478 (amendment 14): a card's `### Identity` (`templates/card-template.md`): its `Class`, `Ascendancy` and `Named damage
 * source` items, `{className, ascendancy, skill}`, each the text after its label; null without the heading or the three.
 */
function identityOf(lines) {
  const at = lines.findIndex((l) => /^###\s+Identity\s*$/.test(l));
  if (at < 0) return null;
  const items = new Map();
  for (let i = at + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i += 1) {
    const m = /^[-*]\s+([^:]+?):\s*(.+)$/.exec(lines[i]);
    if (m) items.set(m[1].trim(), m[2].trim());
  }
  const id = { className: items.get('Class'), ascendancy: items.get('Ascendancy'), skill: items.get('Named damage source') };
  return Object.values(id).every(text) ? id : null;
}

/**
 * A card file's Pitch (D-392): each top-level item `- <Field>: <text>` under `### Pitch`, its indented lines
 * joined to it (a nested item with "; "). Returns `{name, fields, changed, made, structure, pieces, measured}`: the
 * name (`Name`, or a card from before amendment 7's `Title`), every field by its name (`Obvious build` among them,
 * D-403), the gate lines R1b adds, `- Changed at the gate (visit <n>): <words>` and `- Made at the gate (visit <n>):
 * from <name> and <name>: <words>`, each `{visit, text, line}`, the verification half's structure check (D-406,
 * `structureCheck`), and a composite's Pieces and Pieces measured tables (D-433; null on a plain card). Amendment 11:
 * `external`, the URLs of the published guides it cites (`external | <url>`, D-445), and `cantShow`, its checklist row
 * 4's detail, the risks PoB can't show (D-436).
 */
export function parseCard(textOrNull) {
  const out = { name: null, fields: new Map(), changed: [], made: [], structure: null, pieces: null, measured: null, external: [], cantShow: null, identity: null };
  if (typeof textOrNull !== 'string') return out;
  const lines = textOrNull.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
  out.identity = identityOf(lines);
  out.structure = structureCheck(lines);
  out.pieces = piecesTable(lines);
  out.measured = measuredTable(lines);
  // D-445: the published guides the card draws on; D-436: what PoB can't show, from its checklist.
  out.external = externalSources(lines.join('\n'));
  out.cantShow = cantShow(lines);
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
 *
 * Amendment 10 (D-429, D-432; Appendix A), a composite deck (`composite`, its first H2 "What the composites share"):
 * its rounds' lines are its composites `r<k>-s-<n>`; `## Cards` lines are entries too (section `Cards`, round null), each
 * with its `seed` mark and `fed`, the composite ids after `fed:` ([] for `none`, null with no such part); `obvious`, the
 * line under `## The obvious build`; `superseded`, each `- <old id> "<name>" → <new id>` as `{old, name, next, ok}`.
 */
export function parseDeck(textOrNull) {
  const deck = { h2: [], share: null, differ: null, entries: [], found: [], lines: [], obvious: null, superseded: [], composite: false };
  if (typeof textOrNull !== 'string') return deck;
  const lines = textOrNull.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
  deck.lines = lines;
  let section = null;
  const body = new Map();
  /** A line `- <id> "<Name>" | <part> | …`, split. */
  const split = (itemText) => {
    const m = /^(\S+)(?:\s+"([^"]*)")?\s*(.*)$/.exec(itemText);
    const rest = m[3].replace(/^\|\s*/, '');
    return { id: m[1], name: m[2] ?? null, parts: rest === '' ? [] : rest.split(/\s+\|\s+/).map((p) => p.trim()) };
  };
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
    // D-429, Appendix A: the composite deck's obvious build, `- <id> "<name>" | <its kit>`.
    if (section === COMPOSITE_HEADER[2]) {
      if (deck.obvious === null) deck.obvious = { ...split(item[1]), raw: raw.trim(), n: i + 1 };
      return;
    }
    // D-429: `- <old id> "<name>" → <new id>`, a composite a later round recomposed, still pickable.
    if (section === SUPERSEDED) {
      const s = /^(\S+)(?:\s+"([^"]*)")?\s*(?:→|->)\s*(\S+)\s*$/.exec(item[1].trim());
      deck.superseded.push({ old: s?.[1] ?? item[1].trim().split(/\s+/)[0], name: s?.[2] ?? null, next: s?.[3] ?? null, ok: s !== null, raw: raw.trim(), n: i + 1 });
      return;
    }
    const round = /^Round ([1-9]\d*)$/.exec(section);
    if (!round && section !== 'Not dealt' && section !== 'Cards') return;
    const { id, name, parts } = split(item[1]);
    const fed = parts.find((p) => /^fed:/i.test(p))?.replace(/^fed:\s*/i, '').trim();
    deck.entries.push({
      id, name, parts, raw: raw.trim(), n: i + 1, section, round: round ? Number(round[1]) : null,
      made: parts.find((p) => p.toLowerCase().startsWith(MADE_MARK)) ?? null,
      underPlayed: parts.find((p) => /^under-played\b/i.test(p)) ?? null,
      engines: parts.filter((p) => /^engine\b/i.test(p)).map(engineOf),
      waits: parts.find((p) => WAITS_ON_PIN.test(p)) ?? null,
      // D-429: a `## Cards` line's seed mark (D-393) and the composites it fed.
      seed: parts.some((p) => /^seed\b/i.test(p)),
      fed: fed === undefined ? null : fed === 'none' ? [] : fed.split(/\s*,\s*/).filter((x) => x !== ''),
    });
  });
  const paragraph = (title) => (body.has(title) ? body.get(title).map((l) => l.raw).join(' ') : null);
  deck.composite = deck.h2.includes(COMPOSITE_HEADER[0]);
  deck.share = paragraph(deck.composite ? COMPOSITE_HEADER[0] : 'What the cards share');
  deck.differ = paragraph('How they differ');
  deck.body = body;
  return deck;
}

/**
 * D-430, Appendix A: the ids of a research file's `## Ideas` lines, `- i<k><letter>-<m> | <piece> | …`, with each
 * line's piece and number: `[{id, piece, n}]`.
 */
export function parseIdeas(textOrNull) {
  if (typeof textOrNull !== 'string') return [];
  const out = [];
  let inIdeas = false;
  textOrNull.split('\n').forEach((raw, i) => {
    if (/^#{1,2}\s/.test(raw)) inIdeas = /^##\s+Ideas\s*$/.test(raw);
    else if (inIdeas) {
      const m = new RegExp(`^[-*]\\s+(${PIECE_KEY})\\s*\\|\\s*([^|]*)`).exec(raw.trim());
      if (m) out.push({ id: m[1], piece: m[2].trim(), n: i + 1 });
    }
  });
  return out;
}

/** D-432: every piece key of a run, its cards' Pieces rows' keys and its research files' Ideas ids. */
function pieceKeysOf(dir) {
  const keys = new Set();
  for (const id of listCards(dir)) for (const r of parseCard(readText(dir, `cards/${id}.md`)).pieces?.rows ?? []) keys.add(r.key);
  let files = [];
  try {
    files = fs.readdirSync(path.join(dir, 'research')).filter((f) => f.endsWith('.md'));
  } catch {
    files = [];
  }
  for (const f of files) for (const idea of parseIdeas(readText(dir, `research/${f}`))) keys.add(idea.id);
  return keys;
}

// ---------------------------------------------------------------------------------------------------
// The gate displays (D-367, D-369, D-392; skills/build-guide/references/checkpoints.md)
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
    // D-516: a compile run's or a file run's file card, cards/file.md, beside the card ids.
    return fs.readdirSync(path.join(dir, 'cards')).map((f) => new RegExp(`^(${CARD_ID}|${FILE_ID})\\.md$`).exec(f)?.[1]).filter(Boolean).sort();
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

/**
 * D-459 (amendment 12, Appendix A): the verdict label's three forms from a D1 gate's design field `maxHit` (its deciding
 * row `arbiter` and `oneShot`), as the record's reading gives them (render-audit.mjs's `arbiterLabel12`).
 */
function fieldLabel(m) {
  const a = m.arbiter;
  if (!isObj(a) || !text(a.type)) return 'not measured against the Arbiter';
  const x = survivedPercent(isNum(a.hitsSurvived) ? a.hitsSurvived : 0);
  if (m.oneShot === true) return `one-shot by the Arbiter's ${typeWords(a.type)} hit${x > 0 ? ` (it survives ${x}% of them)` : ''}`;
  if (isNum(a.hitsSurvived) && a.hitsSurvived < 100) return `survives ${x}% of the Arbiter's ${typeWords(a.type)} hits, by evading or deflecting them`;
  return "survives the Arbiter's hits";
}

/**
 * The Arbiter's verdict in words: the record's `measures.arbiter`, or the D1 gate's text ("survives, worst physical 0.68").
 * D-459 (amendment 12): a record whose rows carry hits survived, and a design field's `maxHit`, read in the verdict
 * label's three forms, from the deciding row and the floor.
 */
function arbiterWords(a, floor = ARBITER_FLOOR) {
  if (hasHitsSurvived(a)) return arbiterLabel12(arbiterReading(a, floor));
  if (isObj(a) && 'oneShot' in a) return fieldLabel(a);
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
/** D-437, D-447: amendment 11's, with the main skill's two figures. */
const PACE_FIRST_A11 = "Clear speed is a rough estimate from the main skill's area; movement speed is PoB's, over your base speed; damage is the main skill's damage per second against map monsters and against a Pinnacle boss, the boss figure an estimate where PoB can't read the rotation; effective HP is PoB's estimate of the damage it takes to kill you.";
/** D-437: the final display's, with the two figures. */
const FIGURES_MEAN_A11 = "Damage is the main skill's damage per second against map monsters and against a Pinnacle boss (about, where estimated by hand); effective HP is PoB's estimate of the damage it takes to kill you; clear speed is a rough estimate from the main skill's area.";
/** D-449, D-454 (amendment 12): the design gate's, with the resisting figure, hits survived and the Pinnacle pass. */
const PACE_FIRST_A12 = "Clear speed is a rough estimate from the main skill's area; movement speed is PoB's, over your base speed; damage is the main skill's damage per second against map monsters, against resisting rares (40% fire, cold and lightning resistance) and against a Pinnacle boss, the boss figure an estimate where PoB can't read the rotation; effective HP is PoB's estimate of the damage it takes to kill you; the Arbiter's figures use PoB's Pinnacle boss settings, and hits survived is the share of its hits the build survives in full or by evading or deflecting them, rounded down.";
/** D-454 (amendment 12): the final display's, with the three figures. */
const FIGURES_MEAN_A12 = "Damage is the main skill's damage per second against map monsters, against resisting rares (40% fire, cold and lightning resistance) and against a Pinnacle boss (about, where estimated by hand); effective HP is PoB's estimate of the damage it takes to kill you; clear speed is a rough estimate from the main skill's area.";
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
  // D-491 (amendment 14): a clear skill with no area reads its chains and projectiles, once the record has them (C-33).
  if (noArea(c) && Number.isInteger(c.chains) && Number.isInteger(c.projectiles)) return `no area: chains ${c.chains}, projectiles ${c.projectiles}`;
  if (noArea(c)) return `${c.speed} (PoB gives no area)`;
  if (typeof c?.skill !== 'string') return `${speedOf(c)} (a rough estimate; PoB measured no clear skill)`;
  return `${speedOf(c)} (a rough estimate from ${c.skill}'s area)`;
}
/**
 * A rung's figures in words (D-392): damage, effective HP, the Arbiter on `b` and `n`, and the rough clear speed.
 * Amendment 11 (D-437, D-447; Appendix A): with `two` (`{map, boss, about}`), the damage against map monsters and
 * against a Pinnacle boss (`about` when the boss figure is the hand estimate), then `Effective HP <n>`. Amendment 12
 * (D-454, Appendix A): with `two.resisting` a number, the resisting figure between them, `<map> damage per second against
 * map monsters, <resisting> against resisting rares, <boss> against a Pinnacle boss; Effective HP <n>`.
 */
function rungWords(r, floor = ARBITER_FLOOR) {
  if (isObj(r.two)) {
    const resisting = isNum(r.two.resisting) ? `, ${whole(r.two.resisting)} against resisting rares` : '';
    return [
      `${whole(r.two.map)} damage per second against map monsters${resisting}, ${r.two.about ? 'about ' : ''}${whole(r.two.boss)} against a Pinnacle boss; Effective HP ${whole(r.ehp)}`,
      ...(r.arbiter !== null && r.arbiter !== undefined ? [arbiterWords(r.arbiter, floor)] : []),
      clearWords(r.clearSpeed),
    ].join(', ');
  }
  return [
    `${whole(r.dps)} damage per second`,
    `${whole(r.ehp)} effective HP`,
    ...(r.arbiter !== null && r.arbiter !== undefined ? [arbiterWords(r.arbiter, floor)] : []),
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
  // D-432: the composites, or a plain card on request; a change may add or drop pieces, and a new card may draw on pieces.
  composites: 'Ask anything about these builds first. Then say in your own words which 1 to 3 to verify (by name or number), composites or cards, with any changes you want (a piece to add or drop), or a new card from their cards and pieces; or brainstorm more, or stop.',
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
  // D-480, D-486 (amendment 14): accept alone never means the guide; the gate asks guide or file, and late endgame scaling.
  design14: "Ask anything about this build first. Then accept it (I'll ask: its endgame guide or its PoB file only, and late endgame scaling), ask for changes, go back to the verification gate to finalize another card, or stop.",
  final: 'Ask anything about the guide first. Then accept it, accept it and go back to the verification gate for more builds, add the campaign, ask for changes, or say that you decline it.',
  // D-521 (§17): a compile run's better round: accept writes the final PoB file (F1), under its own name; no guide follows.
  better: "Ask anything about this build first. Then accept it (I'll write its final PoB file into your Builds folder under its own name, beside yours), ask for changes, or stop.",
  betterEscalation: 'Ask anything about this first. Then accept what failed, give guidance for one more try, or stop.',
  // D-522 (§18): a file run's gates, with no verification gate to go back to: its better round's accept places the
  // result again and builds the ladder around it; its ladder's accept asks guide or file, and late endgame scaling.
  fileBetter: "Ask anything about this build first. Then accept it (I'll place it on the ladder again and design the other rungs around it), ask for changes, or stop.",
  fileLadder: "Ask anything about this build first. Then accept it (I'll ask: its guide or its PoB file only, and late endgame scaling), ask for changes, or stop.",
  fileFinal: 'Ask anything about the guide first. Then accept it, add the campaign, ask for changes, or say that you decline it.',
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
  return [...out, ...cantLines(deckLine, plain)];
}

const NOT_CONFIRMED = "Not confirmed in game: no card has been played yet; each rests on the game's text and PoB's model. A card says so where one of its key links isn't confirmed even by a lookup.";

/** Whether a run composes its brainstorm rounds (D-429): its log runs R1a-synthesize, or its deck is a composite deck. */
const composes = (log, deck) => deck.composite || stagesOf(log).some((s) => s.stage === 'R1a-synthesize');

/**
 * D-432, Appendix A: a composite's pieces in short, under its round line: `  in: <pieces>`, `  scheduled: <piece>
 * (<where>)`, `  out: <piece> (<why>)`, names joined with commas, `none` for an empty list. D-442: a run held to
 * amendment 11 drops the `out:` line (`withOut` false); the card and pieces.md keep the out rows and their reasons.
 */
function pieceLines(card, plain, withOut = true) {
  const rows = card.pieces?.rows ?? [];
  const of = (status, show) => {
    const xs = rows.filter((r) => r.status === status);
    return xs.length > 0 ? xs.map(show).join(', ') : 'none';
  };
  return [
    `  in: ${of('in', (r) => plain(r.piece))}`,
    `  scheduled: ${of('scheduled', (r) => `${plain(r.piece)} (${plain(r.where)})`)}`,
    ...(withOut ? [`  out: ${of('out', (r) => `${plain(r.piece)} (${plain(r.why)})`)}`] : []),
  ];
}

/** A URL's host without `www.`, or the URL itself when it doesn't parse. */
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
/**
 * D-445: under a card that draws on a published guide (its `external | <url>` marker), `drawn from <host>`, so the user
 * can tell a known build from the pipeline's own; none for a card that cites none.
 */
const drawnFrom = (card, indent) => (card.external.length > 0 ? [`${indent}drawn from ${[...new Set(card.external.map(hostOf))].join(', ')}`] : []);

/**
 * D-432: the brainstorm display of a composite deck: the brief and the deck's header, then each composite not verified
 * yet, numbered, its round line in names then its pieces in short; the composites a later round superseded, still
 * pickable; the obvious build's line, the baseline as its card was written (D-403); then every plain card `## Cards`
 * lists (the researchers', the gate-made and the rival's) not verified yet, numbered on, its name and structure, one
 * line each; a short round's reason; the invitation; the ids last.
 */
function compositeDisplay(dir, log, deck) {
  const out = [briefLine(log), ''];
  const { cards, name, plain } = cardsOf(dir, deck);
  if (text(deck.share)) out.push(`What the composites share: ${plain(deck.share)}`);
  if (text(deck.differ)) out.push(`How they differ: ${plain(deck.differ)}`);
  out.push(NOT_CONFIRMED, '');
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  const ref = [];
  let k = 0;
  const number = (id) => {
    k += 1;
    ref.push(`${k}. ${name(id)}: ${id}`);
    return k;
  };
  // D-429: a superseded composite keeps its round line; it is shown with its successor, below.
  const superseded = new Set(deck.superseded.map((s) => s.old));
  const composites = deck.entries.filter((d) => d.round !== null && !verified.has(d.id) && !superseded.has(d.id));
  for (const d of composites) {
    const card = cards.get(d.id) ?? parseCard(null);
    // D-442: the out: line is the gate's words, not a format: a composite's Pieces table is the same before and after
    // amendment 11, so a display printed in a log held to its rules (any display after a resume's stamp) drops it.
    out.push(`${number(d.id)}. ${[name(d.id), ...d.parts.map(plain)].join(' | ')}`, ...(card.pieces !== null ? pieceLines(card, plain, !held(log)) : []), ...drawnFrom(card, '  '), '');
  }
  if (composites.length === 0) out.push('No composite is left to verify.', '');
  const old = deck.superseded.filter((s) => !verified.has(s.old));
  if (old.length > 0) {
    out.push('Superseded by a later round, still pickable:', ...old.map((s) => `${number(s.old)}. ${name(s.old)}, superseded by ${s.next === null ? 'a later composite' : name(s.next)}`), '');
  }
  const o = deck.obvious;
  out.push(o === null ? 'The obvious build: none.' : `The obvious build, the baseline as its card was written: ${[name(o.id), ...o.parts.map(plain)].join(' | ')}`, '');
  if (o !== null) ref.push(`Obvious build: ${name(o.id)}: ${o.id}`);
  const plainCards = deck.entries.filter((d) => d.section === 'Cards' && !verified.has(d.id));
  const all = deck.entries.filter((d) => d.section === 'Cards').length;
  out.push(`The plain cards (${all}), each can be verified on its own:`, ...(plainCards.length > 0 ? plainCards.flatMap((d) => [`${number(d.id)}. ${name(d.id)}: ${plain(d.parts[0] ?? 'no structure given')}`, ...drawnFrom(cards.get(d.id) ?? parseCard(null), '   ')]) : ['None left to verify.']), '');
  const short = lastStage(log, ASSEMBLY_STAGES)?.shortReason;
  if (text(short)) out.push(`A short round: ${plain(short)}`, '');
  out.push(INVITE.composites);
  ref.push(`Deck: ${path.join(dir, 'cards.md')}`);
  return [...out, ...reference(ref)];
}

/**
 * D-475 (amendment 13): the first one or two sentences of a text, as the brainstorm display's header prints "what they
 * share"; a sentence ends at `.`, `!` or `?` (a closing quote or bracket kept with it) before a space and its next word.
 */
export function firstSentences(t, n = 2) {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/).slice(0, n).join(' ');
}
/** D-475: the most key pieces a composite's `in:` line shows; the rest are `+ <N> more in cards.md`. */
export const KEY_PIECES = 8;
/**
 * D-475: an `in` piece's rank among a composite's key pieces, by kind: its uniques, then supports, keystones, the
 * under-played rows, then notables (`node`), then the rest; the table's order within a rank.
 */
function keyRank(r) {
  const kind = String(r.kind).replace(/,\s*under-played\s*$/i, '').trim().toLowerCase();
  if (kind === 'unique') return 0;
  if (kind === 'support') return 1;
  if (kind === 'keystone') return 2;
  if (r.underPlayed) return 3;
  if (kind === 'node') return 4;
  return 5;
}
/**
 * D-475 (Appendix A): a composite's pieces in short under its first line, in a log at 13: `  in: <at most 8 key pieces>`
 * then `, + <N> more in cards.md` when it takes more, and `  scheduled: <names>`; no `out:` line.
 */
function keyPieceLines(card, plain) {
  const rows = card.pieces?.rows ?? [];
  const ins = rows.filter((r) => r.status === 'in');
  const shown = ins.map((r, i) => ({ r, i })).sort((a, b) => keyRank(a.r) - keyRank(b.r) || a.i - b.i).slice(0, KEY_PIECES).map(({ r }) => plain(r.piece));
  const more = ins.length - shown.length;
  const scheduled = rows.filter((r) => r.status === 'scheduled').map((r) => plain(r.piece));
  return [
    `  in: ${shown.length > 0 ? shown.join(', ') : 'none'}${more > 0 ? `, + ${more} more in cards.md` : ''}`,
    `  scheduled: ${scheduled.length > 0 ? scheduled.join(', ') : 'none'}`,
  ];
}
/** D-475 (Appendix A): a composite's or a dealt card's first line: `<name>: <structure>; under-played: yes|no`. */
const firstLine = (d, name, plain) => `${name(d.id)}: ${plain(d.parts[0] ?? 'no structure given')}; under-played: ${d.underPlayed !== null ? 'yes' : 'no'}`;
/** A dealt card's lines on why it can't be finalized yet, with the entry it waits on (D-303, D-400). */
function cantLines(deckLine, plain, indent = '   ') {
  const out = [];
  const cant = deckLine?.parts.find((p) => CANT_FINALIZE.test(p));
  if (cant) out.push(`${indent}${plain(cant).replace(/^c/, 'C')}.`);
  const waits = /^waits on the pin:\s*(.+)$/i.exec(deckLine?.waits ?? '')?.[1];
  if (waits) out.push(`${indent}Waits on PoB: ${plain(waits)} isn't in the PoB version this run uses, so the build can't be measured yet.`);
  return out;
}

/**
 * D-475 (amendment 13, Appendix A): the brainstorm display of a composite deck in a log at 13: the brief, the header's
 * first one or two sentences, the not-confirmed sentence; each composite not verified yet, numbered, its first line
 * (`<n>. <name>: <structure>; under-played: yes|no`), its key pieces and scheduled names, `drawn from`; the superseded
 * composites, still pickable; the obvious build's line; the plain cards on one line of names; a short round's reason;
 * the invitation. No "How they differ" and no "For reference": the display's `numbers` map each number to its card id,
 * which `display` records in the visit's `displays[]` entry.
 */
function compositeDisplay13(dir, log, deck) {
  const out = [briefLine(log), ''];
  const { cards, name, plain } = cardsOf(dir, deck);
  if (text(deck.share)) out.push(`What the composites share: ${plain(firstSentences(deck.share))}`);
  out.push(NOT_CONFIRMED, '');
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  const numbers = {};
  let k = 0;
  const number = (id) => {
    k += 1;
    numbers[String(k)] = id;
    return k;
  };
  const superseded = new Set(deck.superseded.map((s) => s.old));
  const composites = deck.entries.filter((d) => d.round !== null && !verified.has(d.id) && !superseded.has(d.id));
  for (const d of composites) {
    const card = cards.get(d.id) ?? parseCard(null);
    out.push(`${number(d.id)}. ${firstLine(d, name, plain)}`, ...(card.pieces !== null ? keyPieceLines(card, plain) : []), ...drawnFrom(card, '  '), '');
  }
  if (composites.length === 0) out.push('No composite is left to verify.', '');
  const old = deck.superseded.filter((s) => !verified.has(s.old));
  if (old.length > 0) {
    out.push('Superseded by a later round, still pickable:', ...old.map((s) => `${number(s.old)}. ${name(s.old)}, superseded by ${s.next === null ? 'a later composite' : name(s.next)}`), '');
  }
  const o = deck.obvious;
  out.push(o === null ? 'The obvious build: none.' : `The obvious build, the baseline as its card was written: ${[name(o.id), ...o.parts.map(plain)].join(' | ')}`, '');
  const plainCards = deck.entries.filter((d) => d.section === 'Cards' && !verified.has(d.id));
  const named = plainCards.map((d) => {
    const hosts = [...new Set((cards.get(d.id) ?? parseCard(null)).external.map(hostOf))];
    return `${name(d.id)}${hosts.length > 0 ? ` (drawn from ${hosts.join(', ')})` : ''}`;
  });
  out.push(`Plain cards: ${named.length > 0 ? named.join(', ') : 'none left to verify'}.`, '');
  const short = lastStage(log, ASSEMBLY_STAGES)?.shortReason;
  if (text(short)) out.push(`A short round: ${plain(short)}`, '');
  out.push(INVITE.composites);
  out.numbers = numbers;
  return out;
}

/**
 * D-475 (amendment 13): the brainstorm display of a dealt deck in a log at 13, with the composite path's cuts: the
 * header's first one or two sentences and no "How they differ"; each dealt card not verified yet, numbered, on its first
 * line (`<n>. <name>: <structure>; under-played: yes|no`), then why it can't be finalized yet and `drawn from`; the
 * not-dealt cards on one line of names; no "For reference": the numbers go in the visit's `displays[]` entry.
 */
function dealtDisplay13(dir, log, deck) {
  const out = [briefLine(log), ''];
  const { cards, name, plain } = cardsOf(dir, deck);
  if (text(deck.share)) out.push(`What the cards share: ${plain(firstSentences(deck.share))}`);
  out.push(NOT_CONFIRMED, '');
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  const dealt = deck.entries.filter((d) => d.round !== null && !verified.has(d.id));
  const numbers = {};
  dealt.forEach((d, k) => {
    const card = cards.get(d.id) ?? parseCard(null);
    numbers[String(k + 1)] = d.id;
    out.push(`${k + 1}. ${firstLine(d, name, plain)}`, ...cantLines(d, plain), ...drawnFrom(card, '   '), '');
  });
  if (dealt.length === 0) out.push('No dealt card is left to verify.', '');
  const short = lastStage(log, ASSEMBLY_STAGES)?.shortReason;
  if (text(short)) out.push(`A short round: ${plain(short)}`, '');
  const notDealt = deck.entries.filter((d) => d.section === 'Not dealt');
  out.push(`Not dealt: ${notDealt.length > 0 ? notDealt.map((d) => name(d.id)).join(', ') : 'none'}.`, '');
  out.push('Found, not used:', ...(deck.found.length > 0 ? deck.found.map((f) => `- ${plain(f.text)}`) : ['None.']), '');
  out.push(INVITE.brainstorm);
  out.numbers = numbers;
  return out;
}

/**
 * D-478 (amendment 14, Appendix A): a card's header on the brainstorm display of a log at 14, `**<n>. <name>** (<class,
 * ascendancy, skill>; under-played: yes|no)`, then its `drawn from <host>` line: the runner writes the card's rotation,
 * what makes it work and the catch under it.
 */
function header14(n, d, card, name, plain, composite = true) {
  // A dealt deck's line leads with its pitch, not the identity: a dealt card's class, ascendancy and skill are its card's.
  const id = !composite && card.identity !== null ? `${card.identity.className}, ${card.identity.ascendancy}, ${card.identity.skill}` : null;
  return [`**${n}. ${name(d.id)}** (${id ?? plain(d.parts[0] ?? 'no structure given')}; under-played: ${d.underPlayed !== null ? 'yes' : 'no'})`, ...drawnFrom(card, '')];
}
/**
 * D-478 (amendment 14, Appendix A): the brainstorm display of a log at 14, on the composite and the dealt-card paths alike:
 * the brief, then one header per composite or dealt card not verified yet (`header14`), the superseded composites still
 * pickable, then the closing lines, one each: the obvious build, the plain cards (a dealt deck's not-dealt cards and its
 * unused findings) and a short round's reason; then the invitation. The key pieces, `scheduled:` lines, the shared header
 * and the not-confirmed sentence stay in cards.md; the visit's `displays[]` entry records the number-to-id map.
 */
function brainstormDisplay14(dir, log, deck) {
  const out = [briefLine(log), ''];
  const { cards, name, plain } = cardsOf(dir, deck);
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  const numbers = {};
  let k = 0;
  const number = (id) => {
    k += 1;
    numbers[String(k)] = id;
    return k;
  };
  const composite = composes(log, deck);
  const superseded = new Set(deck.superseded.map((s) => s.old));
  const shown = deck.entries.filter((d) => d.round !== null && !verified.has(d.id) && !superseded.has(d.id));
  for (const d of shown) out.push(...header14(number(d.id), d, cards.get(d.id) ?? parseCard(null), name, plain, composite));
  if (shown.length === 0) out.push(composite ? 'No composite is left to verify.' : 'No dealt card is left to verify.');
  const old = deck.superseded.filter((s) => !verified.has(s.old));
  for (const s of old) out.push(`**${number(s.old)}. ${name(s.old)}** (superseded by ${s.next === null ? 'a later composite' : name(s.next)}, still pickable)`);
  out.push('');
  if (composite) {
    const o = deck.obvious;
    out.push(`Obvious build: ${o === null ? 'none' : `${name(o.id)} (${plain(o.parts[0] ?? 'no structure given')})`}.`);
    const plainCards = deck.entries.filter((d) => d.section === 'Cards' && !verified.has(d.id)).map((d) => {
      const hosts = [...new Set((cards.get(d.id) ?? parseCard(null)).external.map(hostOf))];
      return `${name(d.id)}${hosts.length > 0 ? ` (drawn from ${hosts.join(', ')})` : ''}`;
    });
    out.push(`Plain cards: ${plainCards.length > 0 ? plainCards.join(', ') : 'none left to verify'}.`);
  } else {
    const notDealt = deck.entries.filter((d) => d.section === 'Not dealt');
    out.push(`Not dealt: ${notDealt.length > 0 ? notDealt.map((d) => name(d.id)).join(', ') : 'none'}.`);
    out.push(`Found, not used: ${deck.found.length > 0 ? deck.found.map((f) => plain(f.text).replace(/\.+$/, '')).join('; ') : 'none'}.`);
  }
  const short = lastStage(log, ASSEMBLY_STAGES)?.shortReason;
  if (text(short)) out.push(`A short round: ${plain(short)}`);
  out.push('', composite ? INVITE.composites : INVITE.brainstorm);
  out.numbers = numbers;
  return out;
}

function brainstormDisplay(dir, log) {
  const out = [briefLine(log), ''];
  const deckText = readText(dir, 'cards.md');
  if (deckText === null) return [...out, 'No cards.md in the run folder.'];
  const deck = parseDeck(deckText);
  // D-478 (amendment 14): a log at 14 prints the headers and the closing lines; the runner writes each card's pitch.
  if (revisionOf(log) >= A14) return brainstormDisplay14(dir, log, deck);
  // D-475 (amendment 13): a log at 13 prints the cut display on both paths.
  if (revisionOf(log) >= A13) return composes(log, deck) ? compositeDisplay13(dir, log, deck) : dealtDisplay13(dir, log, deck);
  if (composes(log, deck)) return compositeDisplay(dir, log, deck);
  const { cards, name, plain } = cardsOf(dir, deck);
  if (text(deck.share)) out.push(`What the cards share: ${plain(deck.share)}`);
  if (text(deck.differ)) out.push(`How they differ: ${plain(deck.differ)}`);
  out.push(NOT_CONFIRMED, '');
  // Every dealt card not verified yet, numbered, its name and its pitch (D-392).
  const verified = new Set(stagesOf(log).filter((s) => s.stage === 'R1b').map((s) => s.concept));
  const dealt = deck.entries.filter((d) => d.round !== null && !verified.has(d.id));
  const ref = [];
  dealt.forEach((d, k) => {
    const card = cards.get(d.id) ?? parseCard(null);
    out.push(`${k + 1}. ${name(d.id)}`, ...pitchLines(card, plain, d), ...drawnFrom(card, '   '), '');
    ref.push(`${k + 1}. ${name(d.id)}: ${d.id}`);
  });
  if (dealt.length === 0) out.push('No dealt card is left to verify.', '');
  const short = lastStage(log, ASSEMBLY_STAGES)?.shortReason;
  if (text(short)) out.push(`A short round: ${plain(short)}`, '');
  const notDealt = deck.entries.filter((d) => d.section === 'Not dealt');
  out.push('Not dealt:', ...(notDealt.length > 0 ? notDealt.map((d) => `- ${name(d.id)}: ${plain(d.parts.join('; ') || 'no reason given')}`) : ['None.']), '');
  out.push('Found, not used:', ...(deck.found.length > 0 ? deck.found.map((f) => `- ${plain(f.text)}`) : ['None.']), '');
  out.push(INVITE.brainstorm);
  if (notDealt.length > 0) ref.push(`Not dealt: ${notDealt.map((d) => `${name(d.id)}: ${d.id}`).join(', ')}`);
  ref.push(`Deck: ${path.join(dir, 'cards.md')}`);
  return [...out, ...reference(ref)];
}

/**
 * The number columns every dossier before amendment 11 has (D-355, D-407, D-433), which amendment 11's drops (D-436): a
 * dossier's form is read by its header (§19), so an older run's dossier keeps its figures after a resume's stamp.
 */
const DOSSIER_NUMBERS = ['Named source DPS', 'Life', 'EHP'];
/**
 * The dossier's table (D-355): its rows `{id, cell(column)}` by its header's columns, and `a11`, whether that header is
 * amendment 11's (no number column) rather than an older dossier's (§19, D-436).
 */
function dossierTable(textOrNull) {
  if (typeof textOrNull !== 'string') return { rows: [], a11: false };
  const rows = textOrNull.split('\n').filter((l) => l.trim().startsWith('|')).map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  const head = rows[0] ?? [];
  return {
    rows: rows.slice(2).filter((r) => CARD.test(r[0] ?? '')).map((r) => ({ id: r[0], cell: (col) => r[head.indexOf(col)] ?? '' })),
    a11: head.length > 0 && !head.some((c) => DOSSIER_NUMBERS.includes(c)),
  };
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

/**
 * A dossier status in words (D-392, D-436): works, works, except <what> (amendment 11's `viable, except <what>`, a piece
 * that does nothing in PoB), failed: <why>, or can't be built yet: <why>; its file path left for reference.
 */
function statusWords(status, plain) {
  const s = String(status).replace(/;?\s*reports\/gates\/\S+/g, '').trim();
  const except = /^viable,\s*except\s+(.+)$/i.exec(s);
  if (except) return `works, except ${plain(except[1])}`;
  if (/^viable\b/i.test(s)) return 'works';
  if (/^can't be finalized yet/i.test(s)) return plain(s.replace(/^can't be finalized yet/i, "can't be built yet"));
  return plain(s.replace(/^failed after (\d+) attempts?/i, (m, n) => `failed after ${n} ${n === '1' ? 'try' : 'tries'}`));
}

const OUTCOME_WORDS = { pass: 'passed', fail: 'failed', infeasible: "found it can't be built as designed", escalated: 'failed and was escalated to you' };

/** D-436: the line under the verification display's cards: no figure is shown before the design. */
export const NUMBERS_LATER = 'Numbers come at the design gate, measured on the full build.';

/**
 * D-436 (Appendix A): one card of the verification display in a run held to amendment 11: its name and status in words,
 * then its synergy, its pitch lines as written, its made and changed lines, the damage kinds PoB shows for the named
 * source, its pieces, its key prices in players' words (D-442), and its risks, what PoB can't verify and its structure
 * check's stronger structure; never a damage, life, EHP, clear-speed or movement-speed figure.
 */
function verifiedCardLines(k, r, card, name, plain) {
  const field = (f) => card.fields.get(f)?.value;
  // D-408: an older run's rival card, read after a resume, keeps its mark.
  const rival = RIVAL_CARD.test(r.id);
  const out = [`${k + 1}. ${name(r.id)}${rival ? ', the rival' : ''}: ${statusWords(r.cell('Status'), plain)}.`];
  const synergy = r.cell('Synergy');
  if (!emptyCell(synergy)) out.push(`   Synergy: ${plain(synergy)}`);
  for (const f of PITCH_LINES) if (text(field(f))) out.push(`   ${f}: ${plain(field(f))}`);
  for (const g of card.made) out.push(`   Made at the gate (visit ${g.visit}): ${plain(g.text)}`);
  for (const g of card.changed) out.push(`   Changed at the gate (visit ${g.visit}): ${plain(g.text)}`);
  const stop = (v) => String(v).trim().replace(/\.+$/, '');
  const damage = r.cell('Damage');
  if (!emptyCell(damage)) out.push(`   Damage: ${plain(stop(damage))}.`);
  const pieces = r.cell('Pieces');
  if (!emptyCell(pieces)) out.push(`   Pieces: ${plain(stop(pieces))}.`);
  const prices = r.cell('Key prices');
  const league = r.cell('League');
  if (!emptyCell(prices)) out.push(`   Key prices: ${playersWords(plain(stop(prices)))}${/^none\b/i.test(league) || emptyCell(league) ? '' : ` (league: ${league})`}.`);
  const tail = [];
  const risk = r.cell('Main risk');
  if (!emptyCell(risk)) tail.push(`Risks: ${plain(stop(risk))}.`);
  if (text(card.cantShow)) tail.push(`PoB can't verify: ${plain(stop(card.cantShow))}.`);
  if (text(card.structure?.stronger)) tail.push(`${STRONGER} ${plain(card.structure.stronger)}`);
  if (tail.length > 0) out.push(`   ${tail.join('  ')}`);
  return out;
}

/** D-479 (Appendix A): the skeleton file's line says what the file holds. */
export const SKELETON_NOTE = "key pieces only; its numbers aren't the build's";
/**
 * D-479 (amendment 14): a card's skeleton PoB file on the verification display: its last R1b entry's `skeletonFile`,
 * `{file, removed, left}`, `left` when its build's design ran (a D1 gate) and the runner's cleanup didn't remove it (the
 * user changed it, so the server refused); null when R1b recorded none.
 */
function skeletonOf(log, id) {
  const r1b = stagesOf(log).filter((s) => s.stage === 'R1b' && s.concept === id && !['missing', 'refused'].includes(s.outcome)).pop();
  if (!r1b || !text(r1b.skeletonFile)) return null;
  const removed = r1b.skeletonRemoved === true;
  const designed = stagesOf(log).some((s) => s.stage === 'D1-gate' && s.concept === id && !['missing', 'refused'].includes(s.outcome));
  return { file: r1b.skeletonFile, removed, left: designed && !removed };
}
/**
 * D-478 (amendment 14, Appendix A): one card of the verification display in a log at 14: `**<n>. <name>**: <status>`,
 * then one bullet per field with a bold label, its skeleton file first (D-479; a changed skeleton left in place says
 * so; a removed one is gone), and the tail as three bullets, Risks, PoB can't verify and Stronger structure. No cuts.
 */
function verifiedCardLines14(k, r, card, name, plain, skeleton) {
  const field = (f) => card.fields.get(f)?.value;
  const rival = RIVAL_CARD.test(r.id);
  const out = [`**${k + 1}. ${name(r.id)}${rival ? ', the rival' : ''}**: ${statusWords(r.cell('Status'), plain)}`];
  const item = (label, v) => out.push(`- **${label}:** ${v}`);
  if (skeleton !== null && !skeleton.removed) item('PoB file', `${baseName(skeleton.file)} (${SKELETON_NOTE}${skeleton.left ? '; you changed it in PoB, so it stays' : ''})`);
  const stop = (v) => String(v).trim().replace(/\.+$/, '');
  const synergy = r.cell('Synergy');
  if (!emptyCell(synergy)) item('Synergy', plain(synergy));
  for (const f of PITCH_LINES) if (text(field(f))) item(f, plain(field(f)));
  for (const g of card.made) item(`Made at the gate (visit ${g.visit})`, plain(g.text));
  for (const g of card.changed) item(`Changed at the gate (visit ${g.visit})`, plain(g.text));
  const damage = r.cell('Damage');
  if (!emptyCell(damage)) item('Damage', `${plain(stop(damage))}.`);
  const pieces = r.cell('Pieces');
  if (!emptyCell(pieces)) item('Pieces', `${plain(stop(pieces))}.`);
  const prices = r.cell('Key prices');
  const league = r.cell('League');
  if (!emptyCell(prices)) item('Key prices', `${playersWords(plain(stop(prices)))}${/^none\b/i.test(league) || emptyCell(league) ? '' : ` (league: ${league})`}.`);
  const risk = r.cell('Main risk');
  if (!emptyCell(risk)) item('Risks', `${plain(stop(risk))}.`);
  if (text(card.cantShow)) item("PoB can't verify", `${plain(stop(card.cantShow))}.`);
  if (text(card.structure?.stronger)) item('Stronger structure', plain(card.structure.stronger));
  return out;
}

function verificationDisplay(dir, log) {
  const dossier = readText(dir, 'dossier.md');
  const { cards, name, plain } = cardsOf(dir);
  const out = [];
  const ref = [];
  const { rows, a11 } = dossierTable(dossier);
  if (dossier === null) out.push('No dossier.md in the run folder.', '');
  // §19, D-436: a dossier in amendment 11's columns shows each card with no figure; an older dossier, read by its own
  // header, keeps its skeleton's figures, in a log a resume stamped too.
  rows.forEach((r, k) => {
    const card = cards.get(r.id) ?? parseCard(null);
    // D-478 (amendment 14): a log at 14 prints the same content in bold labels and bullets, the skeleton file first.
    if (a11 && revisionOf(log) >= A14) {
      out.push(...verifiedCardLines14(k, r, card, name, plain, skeletonOf(log, r.id)), '');
      ref.push(`${k + 1}. ${name(r.id)}: ${r.id}`);
      return;
    }
    if (a11) {
      out.push(...verifiedCardLines(k, r, card, name, plain), '');
      ref.push(`${k + 1}. ${name(r.id)}: ${r.id}`);
      return;
    }
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
      // D-423: the effective HP names the hit the dossier's EHP column gives ("31,500 vs T15 map hits").
      const hit = /\bvs\.?\s+(.+)$/i.exec(r.cell('EHP'))?.[1]?.trim();
      out.push(`   Toughness: ${whole(fig.life)} life and ${whole(fig.ehp)} effective HP${hit ? ` against ${plain(hit)}` : ''} (PoB's estimate of the damage it takes to kill you).`);
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
  if (a11 && rows.length > 0) out.push(NUMBERS_LATER, '');
  // D-408: a rival that found no faster structure says so, with what it tried (an older run's).
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
 * D-415, as D-507 amends it: whether two recorded digests differ. Two lists compare as sets, a string with a list's
 * first entry (none when the list is empty), two strings as text; a record that is neither (a migrated run's null) is
 * never a change.
 */
export function digestsDiffer(before, now) {
  const isList = (v) => Array.isArray(v) && v.every((x) => text(x));
  if (!(text(before) || isList(before)) || !(text(now) || isList(now))) return false;
  if (isList(before) && isList(now)) {
    const [a, b] = [new Set(before), new Set(now)];
    return a.size !== b.size || [...a].some((x) => !b.has(x));
  }
  if (isList(before)) return before[0] !== now;
  if (isList(now)) return now[0] !== before;
  return before !== now;
}
const digestWords = (v) => (Array.isArray(v) ? (v.length > 0 ? v.join(', ') : 'none') : v);

/**
 * D-415: when the pin's commit or the league digests differ from the ones the run last recorded (the resume before
 * this session's, or init's), the verification display says so: a card verified on the old pin may still be
 * finalized, its skeleton's figures the old pin's, and the design measures afresh.
 */
function pinChanges(log) {
  const recorded = [{ pinCommit: log.pinCommit, digest: log.digest }, ...objects(log.resumes)];
  const now = recorded.length > 1 ? recorded[recorded.length - 1] : { pinCommit: pinCommit(), digest: runningDigestNames() };
  const before = recorded.length > 1 ? recorded[recorded.length - 2] : recorded[0];
  const out = [];
  if (text(before.pinCommit) && text(now.pinCommit) && before.pinCommit !== now.pinCommit) {
    out.push(`PoB's version changed since this run last ran (commit ${before.pinCommit.slice(0, 7)}, now ${now.pinCommit.slice(0, 7)}): a card verified before keeps its skeleton's figures from the old version, and its design measures afresh.`);
  }
  // D-507: a list on either side reads as the running leagues' digests; two strings keep D-415's line as it was.
  if (digestsDiffer(before.digest, now.digest)) {
    out.push(text(before.digest) && text(now.digest) ? `The league digest changed since this run last ran (${before.digest}, now ${now.digest}).` : `The league digests changed since this run last ran (${digestWords(before.digest)}, now ${digestWords(now.digest)}).`);
  }
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
 * left, then each need the tree keeps, one line each, so the user sees why a long branch stays. A pool move (C-55a,
 * D-426), a `bestSwap` with `weaponSet` 1 or 2, names its pool as get_node_power does: `best swap left (weapon set 2): …`.
 */
function treeLines(t, label = 'Full DPS') {
  const s = t.bestSwap;
  const swap = isObj(s) ? `+${pct(s.gainPercent)}% ${label} by moving ${Array.isArray(s.removed) ? s.removed.length : '?'} points from ${names(s.removed)} to ${names(s.added)}` : 'none';
  const pool = isObj(s) && (s.weaponSet === 1 || s.weaponSet === 2) ? ` (weapon set ${s.weaponSet})` : '';
  const needs = Array.isArray(t.needs) ? t.needs.filter(text) : [];
  return [`- Passive tree: ${isNum(t.travel) ? t.travel : '?'} of ${isNum(t.points) ? t.points : '?'} points on travel; best swap left${pool}: ${swap}`, ...needs.map((n) => `- Kept on the tree: ${n}`)];
}

/**
 * D-427 (WU-102): the stage's travel skill beside its movement speed, from the record's `measures.clearSpeed.travel`
 * (`{group, skill, usesPerSecond}` or null): `; travel skill <skill>, <n> uses a second`, or `; no travel skill`; nothing
 * for a record from before M-22, which has no `travel`.
 */
function travelWords(c) {
  if (!isObj(c) || !('travel' in c)) return '';
  const t = c.travel;
  if (!isObj(t) || !text(t.skill)) return '; no travel skill';
  const uses = isNum(t.usesPerSecond) ? `${Number(t.usesPerSecond.toFixed(2))} uses a second` : 'uses a second not measured';
  return `; travel skill ${t.skill.trim()}, ${uses}`;
}

/**
 * D-434, Appendix A: the design display's pieces line, `- Pieces: <n> in, <n> scheduled (<names>), <n> out (<names>)`,
 * from the D1 gate's `design.pieces {in, scheduled, out, scheduledNames, outNames}`; `none` for an empty list of names.
 */
function piecesLine(p, a11 = false) {
  const count = (v) => (Number.isInteger(v) && v >= 0 ? v : '?');
  const named = (v) => (Array.isArray(v) && v.some(text) ? v.filter(text).map((x) => x.trim()).join(', ') : 'none');
  // D-442: a design field written under amendment 11 counts its out pieces without naming them.
  if (a11) return `- Pieces: ${count(p.in)} in, ${count(p.scheduled)} scheduled (${named(p.scheduledNames)}), ${count(p.out)} out`;
  return `- Pieces: ${count(p.in)} in, ${count(p.scheduled)} scheduled (${named(p.scheduledNames)}), ${count(p.out)} out (${named(p.outNames)})`;
}

/** The skill's own references (amendment 11, Appendix A): `toughness-targets.json` and `boss-floor.json`; null when unreadable. */
export function referenceJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references', name), 'utf8'));
  } catch {
    return null;
  }
}

/** A signed percentage as the trades print it: `+17%`, `−9%`. */
const signed = (v) => (isNum(v) ? `${v < 0 ? '−' : '+'}${pct(Math.abs(v))}%` : '?');
/** A rate a second, to two decimals at most. */
const rate = (v) => (isNum(v) ? String(Number(v.toFixed(2))) : '?');

/** D-437: the named source's skill on a stage: the record's `skillOutputs` at the plan's `skills.main` key, else its first gem. */
function sourceSkill(plan, rec, stageId) {
  const st = objects(plan?.stages).find((x) => x.id === stageId);
  const m = isObj(st?.skills?.main) ? st.skills.main : { group: 1, activeSkill: 1 };
  const key = `g${m.group}s${m.activeSkill}p${m.statSet ?? 1}`;
  const skill = rec?.skillOutputs?.[key]?.skill ?? objects(st?.skills?.groups)[m.group - 1]?.gems?.[0]?.name;
  return text(skill) ? skill : 'the main skill';
}

/**
 * D-437, D-447, D-448, D-441 (Appendix A): a rung's damage lines on the design display of a run held to amendment 11,
 * from the D1 gate's design field: the figure against map monsters, the boss line (the estimate with what it corrects,
 * else PoB alone), the non-budget rung's floor, the cull line with `skills.cull`, and the trigger line.
 */
function damageLines(r, skill) {
  const out = [`- Damage: ${whole(r.damage.map)} per second against map monsters.`];
  const b = isObj(r.boss) ? r.boss : { measured: r.damage.boss, estimate: null, corrections: [] };
  const t = isObj(r.trigger) ? r.trigger : null;
  const handCast = t ? ` at ${skill}'s hand-cast ${rate(t.usesPerSecond)} a second` : '';
  const estimated = isNum(b.estimate);
  if (estimated) {
    const corrections = Array.isArray(b.corrections) && b.corrections.some(text) ? b.corrections.filter(text).map((c) => c.trim()).join('; ') : 'by hand';
    out.push(`- Boss damage: about ${whole(b.estimate)} per second against a Pinnacle boss (PoB alone: ${whole(b.measured)}${handCast}; estimated: ${corrections}).`);
  } else out.push(`- Boss damage: ${whole(b.measured)} per second against a Pinnacle boss${t ? ` (PoB alone${handCast})` : ''}.`);
  if (isNum(b.floor)) {
    const figure = `${estimated ? 'about ' : ''}${whole(estimated ? b.estimate : b.measured)}`;
    out.push(b.under === true ? `- Boss floor: ${figure}, under the ${whole(b.floor)} floor.` : `- Boss floor: ${figure} against the ${whole(b.floor)} floor.`);
  }
  // D-454 (amendment 12, Appendix A): the resisting figure, after the boss lines, on every variant rung that carries it.
  if (isNum(r.damage.resisting)) out.push(`- Resisting rares: ${whole(r.damage.resisting)} per second (40% fire, cold and lightning resistance).`);
  if (isObj(r.cull)) out.push(`- Culls normal monsters at ${pct(r.cull.map)}%, bosses at ${pct(r.cull.boss)}%.`);
  if (t) out.push(`- ${skill} is triggered by ${t.by}: PoB rates it at its hand-cast speed (${rate(t.usesPerSecond)} a second) and doesn't model Energy.`);
  return out;
}

/** D-441: a band in words, as the toughness and the conditioned lines write it. */
function bandWords(band, target) {
  const targets = referenceJson('toughness-targets.json');
  const [under, over] = [isNum(targets?.under) ? targets.under : 0.9, isNum(targets?.over) ? targets.over : 1.5];
  return band === 'under' ? `under its band (${whole(target * under)})` : band === 'over' ? `over its band (${whole(target * over)})` : `within its band (${whole(target * under)}–${whole(target * over)})`;
}

/** D-441 (Appendix A): the non-budget rung's toughness line, its EHP against its target, the engagement and the band. */
function toughnessLine(r) {
  const t = r.toughness;
  return `- Toughness: ${whole(r.ehp)} against the ${whole(t.target)} target for a ${t.engagement} build${text(t.reason) ? ` (${t.reason.trim()})` : ''}, ${bandWords(t.band, t.target)}.`;
}

/**
 * D-449 (amendment 12, Appendix A): the non-budget rung's lines after its toughness line, from the design field's
 * `toughness`: the conditioned read and its band, deflection's average cut to ailment damage on a build that deflects
 * (PG-97), and the warning, in plain words, naming its type and the fix family.
 */
function toughnessLines12(r) {
  const t = r.toughness;
  const out = [];
  const c = t.conditioned;
  if (isObj(c) && isNum(c.ehp)) out.push(`- With every condition against it (unlucky rolls, hit recently, not blinded, Wind Dancer at 0): ${whole(c.ehp)}, ${bandWords(c.band, t.target)}.`);
  if (isNum(t.ailmentCut) && t.ailmentCut > 0) out.push(`- Deflection cuts ailment damage from hits by about ${Math.round(t.ailmentCut)}% on average; PoB doesn't apply it.`);
  const w = t.warning;
  if (isObj(w) && w.kind === 'one-shot') {
    const share = isNum(t.chanceShare) ? `, and ${Math.round(t.chanceShare)}% of the EHP is chance layers` : '';
    out.push(`- Warning: the EHP reads ${t.band === 'over' ? 'over' : 'within'} its band, but the Arbiter's ${typeWords(w.type)} hit one-shots this build${share}. The fix is ${String(w.fix ?? '').trim().replace(/\.+$/, '')}.`);
  } else if (isObj(w) && w.kind === 'conditioned') {
    out.push(`- Warning: with every condition against it the EHP falls under its band; its weakest hit is ${typeWords(w.type)}. The fix is ${String(w.fix ?? '').trim().replace(/\.+$/, '')}.`);
  } else if (isObj(w) && w.kind === 'under') {
    // D-494 (amendment 14): the EHP is under its band in every condition, not only with every condition against it.
    out.push(`- Warning: the EHP is under its band in every condition; its weakest hit is ${typeWords(w.type)}. The fix is ${String(w.fix ?? '').trim().replace(/\.+$/, '')}.`);
  }
  return out;
}

/**
 * D-449 (amendment 12, Appendix A): a `b` or `n` rung's Arbiter lines on the design display, from the design field's
 * `maxHit` (its deciding row `arbiter`, `oneShot`, `lowest`) and the full hit's ratio from the gate's record: the Arbiter
 * line in its three forms, with hits survived rounded down and the chances at the Arbiter, `under the <floor> floor` on a
 * one-shot rung; then `Lowest max hit: <n> <type>`; then PG-100's note when the record's `avoid.companionDeflected` says a
 * companion takes part of each deflected hit (PoB's `TakenFromCompanionBeforeYouFromDeflected`, whatever its source).
 */
function arbiterLines12(r, rec, floor) {
  const m = r.maxHit;
  const a = isObj(m.arbiter) ? m.arbiter : null;
  const out = [];
  if (a === null || !text(a.type)) out.push('- The Arbiter of Divinity: not measured.');
  else {
    const row = objects(rec?.measures?.arbiter?.rows).find((x) => x.type === a.type);
    const ratio = isNum(row?.ratio) ? row.ratio : null;
    // WU-120: a one-shot row with no ratio is one whose max hit of its type is 0.
    const zero = ratio === null && row?.verdict === 'one-shot' && row?.maxHit === 0;
    const hit = `${typeWords(a.type)} hit`;
    const x = survivedPercent(isNum(a.hitsSurvived) ? a.hitsSurvived : 0);
    const chance = (v) => (isNum(v) && v > 0 ? Math.round(v) : null);
    const [evade, deflect] = [chance(a.evade), chance(a.deflect)];
    const accuracy = isNum(rec?.measures?.arbiter?.avoid?.accuracy) ? rec.measures.arbiter.avoid.accuracy : 3786;
    const chances = [evade !== null ? `evades ${evade}%` : null, deflect !== null ? `deflects ${deflect}%` : null].filter(Boolean);
    const at = chances.length > 0 ? `${chances.join(', ')} at its accuracy of ${whole(accuracy)}` : null;
    // With PoB's formula in place of a measure pass, a deflected hit reads optimistic when the build has armour (R-49).
    const optimistic = a.method === 'formula' && isNum(rec?.outputs?.Armour) && rec.outputs.Armour > 0 ? ' (by formula; optimistic with armour)' : '';
    const deflected = deflect !== null && isNum(a.deflectedRatio) ? (a.deflectedRatio < 1 ? `a deflected hit is ${a.deflectedRatio.toFixed(2)} of your max hit${optimistic}` : 'a deflected hit kills too, so only evading counts') : null;
    const floorWords = `${Math.round(floor * 100)}%`;
    if (m.oneShot === true) {
      const head = `- The Arbiter of Divinity: one-shot by its ${hit}${ratio !== null ? ` (${ratio.toFixed(2)} of your max hit)` : zero ? ' (a max hit of 0)' : ''}`;
      out.push(at === null ? `${head}, under the ${floorWords} floor.` : `${head}; survives ${x}% of them by evading or deflecting (${[at, deflected].filter(Boolean).join('; ')}), under the ${floorWords} floor.`);
    } else if (isNum(a.hitsSurvived) && a.hitsSurvived < 100) {
      const inner = [at];
      if (deflected !== null && a.deflectedRatio < 1) inner.push(`${deflected}${ratio !== null ? `, a full one ${ratio.toFixed(2)}` : ''}`);
      else inner.push(deflected, ratio !== null ? `a full one is ${ratio.toFixed(2)} of your max hit` : null);
      const words = inner.filter(Boolean);
      out.push(`- The Arbiter of Divinity: survives ${x}% of its ${typeWords(a.type)} hits by evading or deflecting them${words.length > 0 ? ` (${words.join('; ')})` : ''}.`);
    } else out.push(`- The Arbiter of Divinity: survives its hits${ratio !== null ? ` (its worst, a ${hit}, is ${ratio.toFixed(2)} of your max hit)` : ''}.`);
  }
  const lowest = isObj(m.lowest) && isNum(m.lowest.value) && text(m.lowest.type) ? `${whole(m.lowest.value)} ${typeWords(m.lowest.type)}` : 'not measured';
  out.push(`- Lowest max hit: ${lowest}.`);
  const companion = rec?.measures?.arbiter?.avoid?.companionDeflected;
  if (isNum(companion) && companion > 0) out.push('- Note: a companion takes part of each deflected hit, so hits survived reads high (PG-100).');
  return out;
}

/**
 * Appendix A (amendment 12): a trade's reason may end with the boss cut D1-finish measured on the trade's temporary stage,
 * `; cuts <entry> against a boss by <x>%` (a cut over 2% to a boss-rotation entry, D-456), which its line prints last.
 */
const BOSS_CUT = /(?:^|;\s*)(cuts .+ against a boss by [\d.]+%)\s*$/;

/**
 * D-439, D-440, D-441, D-448 (Appendix A): a rung's trades from `trades.json`, as the design field carries them: an
 * unmodelled need's cost, the boots' exception, the defence trade and the damage trade, the latter with its boss figure
 * after (`bossAfter`) on the non-budget rung. Amendment 12 (D-450, Appendix A): a trade with `maxHit` or `hitsSurvived`
 * (a build held to revision 12) prints them (the max hit when the trade moves it), a defence trade on a one-shot rung as
 * `Defence (one-shot)`, and the avoidance trade, `- Avoidance: <what>: hits survived <x>% → <y>%; <EHP>, <damage>
 * (<reason>).`; a reason ending `; cuts <entry> against a boss by <x>%` prints that cut last; each kind in rank order.
 */
function tradeLines(r, rec = null) {
  const order = ['unmodelled', 'boots', 'defence', 'avoidance', 'damage', 'boss'];
  const trades = objects(r.trades).filter((t) => order.includes(t.kind)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const stop = (v) => String(v ?? '').trim().replace(/\.+$/, '');
  const rows = objects(rec?.measures?.arbiter?.rows);
  return trades.map((t) => {
    // D-468 (amendment 13, Appendix A): the alternative tree that keeps the start's boss figure, against the gate's figure.
    if (t.kind === 'boss') {
      const n = isObj(t.nodes) ? t.nodes : {};
      const count = (v) => (Array.isArray(v) ? v.length : 0);
      const b = isObj(r.boss) ? r.boss : {};
      const now = isNum(b.estimate) ? b.estimate : b.measured;
      const changes = [isNum(t.damageChange) ? `damage ${signed(t.damageChange)}` : null, isNum(t.ehpChange) ? `EHP ${signed(t.ehpChange)}` : null].filter(Boolean);
      return `- Boss trade on ${t.stage}: ${stop(t.what)} (remove ${count(n.remove)}, add ${count(n.add)}): boss ${whole(now)} → ${whole(t.bossAfter)}${changes.length > 0 ? `, ${changes.join(', ')}` : ''}.`;
    }
    const none = /^none found\b/i.test(String(t.what ?? '').trim());
    // D-489 (amendment 14, §15): a piece the design leaves out unmeasured (its `what` says so) reaches the user as left out,
    // with its estimate; a null part of the estimate is left out.
    const outUnmeasured = t.kind === 'unmodelled' ? /^(.*?)[,;:]?\s*left out unmeasured\b/i.exec(String(t.what ?? '').trim()) : null;
    if (outUnmeasured) {
      const est = [isNum(t.ehpChange) ? `EHP ${signed(t.ehpChange)}` : null, isNum(t.damageChange) ? `damage ${signed(t.damageChange)}` : null].filter(Boolean);
      return `- Left out unmeasured: ${stop(outUnmeasured[1])}${est.length > 0 ? ` (estimate: ${est.join(', ')})` : ''}: ${stop(t.reason)}.`;
    }
    if (t.kind === 'unmodelled') return `- Kept for ${stop(t.reason)}, which PoB can't measure: ${stop(t.what)}${isNum(t.damageChange) ? ` would ${t.damageChange < 0 ? 'cost' : 'add'} ${pct(Math.abs(t.damageChange))}% damage` : ''}.`;
    if (t.kind === 'boots') return `- Boots: ${stop(t.what)}${text(t.reason) ? `, for ${stop(t.reason)}` : ''}.`;
    const a12 = 'maxHit' in t || 'hitsSurvived' in t;
    const reason = stop(t.reason);
    const cut = a12 ? BOSS_CUT.exec(reason)?.[1] ?? null : null;
    const why = cut === null ? reason : reason.slice(0, reason.length - cut.length).replace(/[;\s]+$/, '');
    const label = t.kind === 'defence' ? (a12 && /^one-shot\b/i.test(why) ? 'Defence (one-shot)' : 'Defence') : t.kind === 'avoidance' ? 'Avoidance' : 'Damage';
    // Appendix A: the defence trade's line is `- Defence: …` and the damage trade's `- Damage: …`, after the figures.
    if (none) return `- ${label}: ${stop(t.what)}.`;
    const ehp = isNum(t.ehpChange) ? `${signed(t.ehpChange)} EHP` : null;
    const damage = isNum(t.damageChange) ? `${signed(t.damageChange)} damage` : null;
    // The deciding row's max hit shows when the trade moves it (a deflection trade leaves it, Appendix A's second line).
    const mh = isObj(t.maxHit) && isNum(t.maxHit.before) && isNum(t.maxHit.after) && t.maxHit.after !== t.maxHit.before ? t.maxHit : null;
    const top = mh ? rows.find((x) => x.type === mh.type)?.hit : undefined;
    const maxHitPart = mh ? `the Arbiter's ${typeWords(mh.type)} max hit (Pinnacle pass) ${whole(mh.before)} → ${whole(mh.after)}${isNum(top) && mh.after > top ? ', survives the full hit' : ''}` : null;
    const hs = isObj(t.hitsSurvived) && isNum(t.hitsSurvived.before) && isNum(t.hitsSurvived.after) ? `hits survived ${survivedPercent(t.hitsSurvived.before)}% → ${survivedPercent(t.hitsSurvived.after)}%` : null;
    const groups = (...g) => g.filter((x) => typeof x === 'string' && x !== '').join('; ');
    if (t.kind === 'defence') {
      if (!a12) return `- Defence: ${stop(t.what)}: ${[ehp, damage].filter(Boolean).join(', ')}.`;
      return `- ${label}: ${stop(t.what)}: ${groups([maxHitPart, hs].filter(Boolean).join(', '), [ehp, damage].filter(Boolean).join(', '), cut)}.`;
    }
    if (t.kind === 'avoidance') return `- Avoidance: ${stop(t.what)}: ${groups(hs, [ehp, damage].filter(Boolean).join(', '), cut)}${why !== '' ? ` (${why})` : ''}.`;
    const bossAfter = isNum(t.bossAfter) ? t.bossAfter : null;
    const changes = [`${signed(t.damageChange)} damage${bossAfter !== null ? ` (boss about ${whole(bossAfter)})` : ''}`, ehp].filter(Boolean).join(', ');
    return `- Damage: ${stop(t.what)}: ${a12 ? groups(changes, maxHitPart, cut) : changes}.`;
  });
}

/**
 * D-437: the best swap's label: "damage" under amendment 11's rules (`a11`; node power ranks by `MainDamage`), except a
 * pool move on a weapon set that doesn't hold the main group, which keeps Full DPS; "Full DPS" under the older rules. The
 * design display passes the design field's own form (`designA11`), the run checker whether the D1 gate's entry is held.
 */
export function swapLabel(a11, t, plan, stageId) {
  if (!a11) return 'Full DPS';
  const ws = t?.bestSwap?.weaponSet;
  if (ws !== 1 && ws !== 2) return 'damage';
  const st = objects(plan?.stages).find((x) => x.id === stageId);
  const main = objects(st?.skills?.groups)[(st?.skills?.main?.group ?? 1) - 1];
  return (main?.weaponSet === 2 ? 2 : 1) === ws ? 'damage' : 'Full DPS';
}

/** Appendix A's additions to a D1 gate's design rung (amendment 11): `damage {map, boss}`, `cull`, `trigger`, `boss`, `toughness`, `trades`. */
const DESIGN_A11_FIELDS = ['damage', 'cull', 'trigger', 'boss', 'toughness', 'trades'];
/**
 * §19: whether a D1 gate's design field is amendment 11's, read by its own fields rather than by the log's stamp: a rung
 * carries one of Appendix A's additions, or its best swap the branches it freed (D-439). A design field written before
 * the stamp has none of them and keeps its old display ("Full DPS", one figure, the out pieces named).
 */
function designA11(design) {
  return objects(design?.rungs).some((r) => DESIGN_A11_FIELDS.some((k) => k in r) || (isObj(r.tree?.bestSwap) && 'branches' in r.tree.bestSwap));
}
/**
 * Amendment 12 (§22, Appendix A): whether a D1 gate's design field is amendment 12's, read by its own fields: a rung
 * carries `maxHit` or `damage.resisting`. One written under amendment 11's rules keeps amendment 11's display.
 */
export function designA12(design) {
  return objects(design?.rungs).some((r) => 'maxHit' in r || (isObj(r.damage) && 'resisting' in r.damage));
}
/** Appendix A (amendment 13): the design rung's additions, beside the boss's `start`, `end`, `entries` and `bossFall`. */
export const DESIGN_A13_FIELDS = ['life', 'swapCap', 'rebuild', 'removedForOthers', 'levels'];
/**
 * Amendment 13 (§22, Appendix A): whether a D1 gate's design field is amendment 13's, read by its own fields: a rung
 * carries one of `life`, `swapCap`, `rebuild`, `removedForOthers` and `levels`, or its boss a `start`.
 */
export function designA13(design) {
  return objects(design?.rungs).some((r) => DESIGN_A13_FIELDS.some((k) => k in r) || (isObj(r.boss) && 'start' in r.boss));
}
/** A path's file name, whichever separator it uses. */
const baseName = (p) => String(p).split(/[\\/]/).pop();
/** A change in percent as the boss lines print it: whole, or one decimal under 1, with its sign: `−5%`, `+6%`. */
const changeWords = (v) => (isNum(v) ? `${v < 0 ? '−' : '+'}${Math.abs(v) < 1 ? pct(Number(Math.abs(v).toFixed(1))) : Math.round(Math.abs(v))}%` : '?');
/**
 * D-468 (Appendix A): a rung's boss rotation line on the design display, from the design field alone: the boss figure at
 * D1-tree's start and end and at the gate (with `boss.floor` on `n`), then each entry's start, end and final figure, a
 * fall's percent after its end figure (an entry valued by the buff shows its `valuedBy` value and reason instead), and the
 * designer's reason for a fall, `bossFall.reason`.
 */
function bossRotationLines(r) {
  const b = isObj(r.boss) ? r.boss : null;
  if (b === null || !('start' in b)) return [];
  const stop = (v) => String(v ?? '').trim().replace(/\.+$/, '');
  const gate = isNum(b.estimate) ? `about ${whole(b.estimate)}` : whole(b.measured);
  const head = `- Boss rotation on ${r.stage}: ${whole(b.start)} → ${whole(b.end)} on the tree, ${gate} at the gate${isNum(b.floor) ? ` (floor ${whole(b.floor)})` : ''}.`;
  const entries = objects(b.entries).map((e) => {
    const v = isObj(e.valuedBy) ? e.valuedBy : null;
    const fall = v === null && isNum(e.start) && isNum(e.end) && e.start > 0 && e.end < e.start ? ` (${changeWords(((e.end - e.start) / e.start) * 100)})` : '';
    const valued = v !== null ? ` (valued by ${stop(v.reason)}: ${changeWords(v.figure)} to the rotation, the designer)` : '';
    return `${stop(e.label)} ${whole(e.start)} → ${whole(e.end)}${fall} → ${whole(e.final)}${valued}`;
  });
  const why = isObj(b.bossFall) && text(b.bossFall.reason) ? stop(b.bossFall.reason) : null;
  if (entries.length > 0) return [`${head} ${entries.join(', ')}${why !== null ? `: ${why} (the designer)` : ''}.`];
  return [why !== null ? `${head} ${why.charAt(0).toUpperCase()}${why.slice(1)} (the designer).` : head];
}
/**
 * D-467, D-473 (Appendix A): a rung's tree-search lines on the design display, from the design field alone: the swap
 * cap when it was hit, an undone rebuild and why, each removed passive with lines for another skill, and each damage
 * skill at +0 levels.
 */
function searchLines(r) {
  const out = [];
  const stop = (v) => String(v ?? '').trim().replace(/\.+$/, '');
  if (isObj(r.swapCap)) out.push(`- Swap cap on ${r.stage}: ${isNum(r.swapCap.swaps) ? r.swapCap.swaps : '?'} swaps, the last ${isNum(r.swapCap.lastGain) ? `+${pct(r.swapCap.lastGain)}%` : 'gain not recorded'}.`);
  const undone = /^undone:\s*(.+)$/s.exec(String(r.rebuild ?? ''));
  if (undone) out.push(`- Rebuild undone on ${r.stage}: ${stop(undone[1])}.`);
  // D-490 (amendment 14): a rebuild node power called illegal, recorded with the tool's reason.
  const none = /^none:\s*(.+)$/s.exec(String(r.rebuild ?? ''));
  if (none) out.push(`- Rebuild not taken on ${r.stage}: ${stop(none[1])}.`);
  for (const x of objects(r.removedForOthers)) out.push(`- Removed on ${r.stage}: ${Array.isArray(x.names) ? x.names.map(stop).join(', ') : stop(x.names)}: lines for ${stop(x.skill)}.`);
  for (const x of objects(r.levels)) out.push(`- Skill levels on ${r.stage}: ${stop(x.skill)} +${isNum(x.plus) ? x.plus : 0}.`);
  return out;
}

/** D-478 (Appendix A): a rung's name on the design display of a build held to 14. */
const RUNG_WORDS = { 'entering-maps': 'entering maps', budget: 'budget endgame', 'non-budget': 'non-budget endgame' };
/** A figure as the [GR] display writes it: 314K, 1.2M; under 10,000 to one decimal of a thousand, under 1,000 whole. */
export function shortFigure(v) {
  if (!isNum(v)) return 'not measured';
  const a = Math.abs(v);
  const trim = (x) => String(Number(x.toFixed(1))).replace(/\.0$/, '');
  if (a >= 1e6) return `${trim(v / 1e6)}M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)}K`;
  if (a >= 1e3) return `${trim(v / 1e3)}K`;
  return String(Math.round(v));
}
/**
 * D-478 (Appendix A): the Arbiter's row of the design table, from the design field's `maxHit` (its deciding row) and the
 * record's row: `survives its hardest hit (<n>% of your max hit)`, `survives <x>% of its <type> hits by evading or
 * deflecting`, `one-shot by its <type> hit` (with the share survived), or `not measured`; an older field's `arbiter` in
 * the verdict label's words.
 */
function arbiterCell(r, rec) {
  const m = r.maxHit;
  if (!isObj(m)) return r.arbiter === null || r.arbiter === undefined ? 'not measured' : arbiterWords(r.arbiter);
  const a = isObj(m.arbiter) ? m.arbiter : null;
  if (a === null || !text(a.type)) return 'not measured';
  const x = survivedPercent(isNum(a.hitsSurvived) ? a.hitsSurvived : 0);
  if (m.oneShot === true) return `one-shot by its ${typeWords(a.type)} hit${x > 0 ? `; survives ${x}% of them by evading or deflecting` : ''}`;
  if (isNum(a.hitsSurvived) && a.hitsSurvived < 100) return `survives ${x}% of its ${typeWords(a.type)} hits by evading or deflecting`;
  const ratio = objects(rec?.measures?.arbiter?.rows).find((row) => row.type === a.type)?.ratio;
  return isNum(ratio) ? `survives its hardest hit (${Math.round(ratio * 100)}% of your max hit)` : 'survives its hits';
}
/**
 * D-478, D-491 (Appendix A): the Speed row: the clear word, or a clear skill with no area's chains and projectiles; PoB's
 * regular movement figure (D-491: never with a skill's use penalty folded in); the travel skill, or "no travel skill".
 */
function speedCell(r, rec) {
  const c = rec?.measures?.clearSpeed;
  const clear = noArea(c) ? clearPhrase(c) : `clear ${speedOf(typeof r.clearSpeed === 'string' ? r.clearSpeed : c)} (rough)`;
  const m = moveOf(rec);
  const move = isNum(m) ? `movement ${Math.round((m - 1) * 100) < 0 ? '' : '+'}${Math.round((m - 1) * 100)}%` : 'movement not measured';
  const t = isObj(c) && 'travel' in c ? (isObj(c.travel) && text(c.travel.skill) ? `travel skill ${c.travel.skill.trim()}` : 'no travel skill') : null;
  return `${clear}; ${move}${t !== null ? `, ${t}` : ''}`;
}
/** D-486 (Appendix A): a price as the Over budget lines say it, in players' words. */
const priceWords = (p) => (isObj(p) && isNum(p.amount) && text(p.currency) ? `about ${playersWords(`${p.amount} ${p.currency}`)} more` : 'price not known');
/**
 * D-478, D-486 (Appendix A): a rung's Over budget lines, at most 3, from trades.json's `scaling` finds (`from`, `to`,
 * `price`): measured finds first by their damage gain, then an unmeasured one marked "(estimate)", each `<from> was
 * swapped for <to>; adding it back: +a% damage, −b% EHP, about N divines more.`; then the rung's other trades (a defence,
 * avoidance, boss, damage or unmeasured piece's), one line each in plain words.
 */
function overBudgetLines(r, rec, finds) {
  const stop = (v) => String(v ?? '').trim().replace(/\.+$/, '');
  const mine = objects(finds).filter((t) => t.kind === 'scaling' && t.stage === r.stage);
  const gain = (t) => (isNum(t.damage) ? t.damage : -Infinity);
  const sorted = [...mine.filter((t) => t.measured === true).sort((a, b) => gain(b) - gain(a)), ...mine.filter((t) => t.measured !== true)].slice(0, 3);
  const lines = sorted.map((t) => `- ${stop(t.from)} was swapped for ${stop(t.to)}; adding it back: ${signed(t.damage)} damage, ${signed(t.ehp)} EHP${t.measured === true ? '' : ' (estimate)'}, ${priceWords(t.price)}.`);
  const others = objects(r.trades).filter((t) => !['scaling', 'boots'].includes(t.kind));
  return [...lines, ...tradeLines({ ...r, trades: others }, rec)];
}
/**
 * D-521 (§17): a better round's targets the user's budget can't reach, each a gate finding with its `cost`: one line each,
 * `<what is short>: <what reaching it would cost>`, the shortfall read from the record (a resistance's percent, a max
 * hit's type), else the finding's message.
 */
function notReachedLines(r, gate, rec) {
  const stop = (v) => String(v ?? '').trim().replace(/\.+$/, '');
  return objects(gate?.findings).filter((f) => f.stage === r.stage && f.part === 'floor' && text(f.cost)).map((f) => {
    const res = /^missing-(fire|cold|lightning|chaos)-resist$/.exec(String(f.code));
    const hit = /^max-hit-(\w+)$/.exec(String(f.code));
    const short = res ? rec?.outputs?.[`Missing${res[1][0].toUpperCase()}${res[1].slice(1)}Resist`] : undefined;
    const what = res ? `${res[1]} resistance${isNum(short) ? ` ${short}% short` : ' short of its cap'}` : hit ? `the ${hit[1]} max hit, under its reference hit` : stop(f.message);
    return `- ${what}: ${stop(f.cost)}.`;
  });
}
/**
 * D-521: the draft a compile run's design gate shows: the one the runner wrote after an escalation's accept of this D1
 * gate attempt (logged on that escalation entry as `draftFile`: a compile run has no builds[], Appendix A.6), else the
 * one the gate wrote on its pass (its verdict's `draft`).
 */
function compileDraft(log, s, gate) {
  const e = objects(log.escalations).filter((x) => x.stage === s.stage && x.concept === s.concept && x.verdict === verdictFile(s) && text(x.draftFile)).pop();
  return e ? e.draftFile : text(gate.draft) ? gate.draft : null;
}
/**
 * D-478 (amendment 14, Appendix A): the design display of a build held to revision 14 by its D1 gate, the user's form
 * [GR]: the PoB file first (the draft, D-479); How it works (the design field's `summary.how`); then each rung, `m` in two
 * lines (its name and level, its damage and EHP; the draft holds the rest), `b` and `n` in full: the five-row table (map
 * damage with the resisting figure, the Pinnacle boss, toughness, the Arbiter's hit, speed), Gear from `summary.gear[]`,
 * Skills from the plan's `skills.groups`, Over budget (`overBudgetLines`); The catch (`summary.catch`); the invitation;
 * and Options, under which the runner gives its `not made:`, `jewel:` and `stronger structure:` lines, one each. Today's
 * measurement lines are `--detail`'s (`designDisplay`).
 */
function designDisplay14(dir, log, s, gate, plan, record, folder) {
  const { name } = cardsOf(dir);
  const b = objects(log.builds).find((x) => x.id === s.concept);
  const buildName = text(b?.name) ? b.name.trim() : name(s.concept);
  // The draft the gate wrote (D-479: builds[].draftFile, else the verdict's draft); once F1 removed it, the final file.
  // D-521: a compile run's, the gate's or an escalation accept's (`compileDraft`).
  // D-522: a file run's better round shows as a compile run's; its ladder shows the placed rung's costed findings too.
  const fileRun = isFileRun(log);
  const compile = pieceOf(log) === 'compile' || (fileRun && s.scope === 'better');
  const draft = pieceOf(log) === 'compile' ? compileDraft(log, s, gate) : text(b?.draftFile) ? b.draftFile : text(b?.pobFile) ? b.pobFile : text(gate.draft) ? gate.draft : null;
  const summary = isObj(gate.design.summary) ? gate.design.summary : {};
  const stop = (v) => String(v ?? '').trim();
  const out = [draft !== null ? `PoB file: ${baseName(draft)} in your Builds folder` : 'PoB file: none written yet', ''];
  out.push(`**How it works.** ${text(summary.how) ? stop(summary.how) : 'not given'}`, '');
  const finds = objects(readJson(dir, inFolder(folder, 'trades.json'))?.trades);
  const stageOf = (id) => objects(plan?.stages).find((x) => x.id === id);
  const rungs = objects(gate.design.rungs).filter((r) => stageOf(r.stage)?.variant !== undefined).sort((x, y) => RUNGS.indexOf(stageOf(x.stage).variant) - RUNGS.indexOf(stageOf(y.stage).variant));
  for (const r of rungs) {
    const st = stageOf(r.stage);
    const rec = record?.stages?.[r.stage];
    const level = isNum(st.level) ? ` (level ${st.level})` : '';
    const head = `**${buildName}: ${RUNG_WORDS[st.variant]}**${level}`;
    const map = isObj(r.damage) ? r.damage.map : r.dps;
    // D-521 (choice A): a better round on m (a character below the endgame) is the round's one rung, shown in full.
    if (st.variant === 'entering-maps' && !compile) {
      out.push(head, `${shortFigure(map)} damage per second on map packs; ${whole(r.ehp)} effective HP; the draft holds the rest.`, '');
      continue;
    }
    const resisting = isObj(r.damage) && isNum(r.damage.resisting) ? r.damage.resisting : null;
    const same = resisting !== null && isNum(map) && Math.abs(resisting - map) <= 0.005 * Math.abs(map);
    const mapCell = `${shortFigure(map)} per second${resisting === null ? '' : same ? ' (the same on 40%-resistance rares)' : `; ${shortFigure(resisting)} on 40%-resistance rares`}`;
    const bo = isObj(r.boss) ? r.boss : { measured: isObj(r.damage) ? r.damage.boss : null, estimate: null };
    const bossCell = isNum(bo.estimate) ? `about ${shortFigure(bo.estimate)} per second (estimated by hand)` : `${shortFigure(bo.measured)} per second`;
    const lowest = isObj(r.maxHit?.lowest) && isNum(r.maxHit.lowest.value) ? `; lowest max hit ${whole(r.maxHit.lowest.value)} (${typeWords(r.maxHit.lowest.type)})` : '';
    out.push(head, '', '| | |', '|---|---|', `| Damage, map packs | ${mapCell} |`, `| Damage, pinnacle boss | ${bossCell} |`, `| Toughness | ${whole(r.ehp)} effective HP${lowest} |`, `| Arbiter of Divinity | ${arbiterCell(r, rec)} |`, `| Speed | ${speedCell(r, rec)} |`, '');
    const gear = objects(summary.gear).filter((g) => g.stage === r.stage);
    out.push('**Gear**', ...(gear.length > 0 ? gear.map((g) => `- ${stop(g.slot)}: ${stop(g.text)}`) : ['- not given']), '');
    const groups = objects(st.skills?.groups).map((g) => objects(g.gems).map((x) => String(x.name ?? '').trim()).filter((x) => x !== '')).filter((g) => g.length > 0);
    out.push('**Skills**', ...(groups.length > 0 ? groups.map(([skill, ...supports]) => `- ${skill}${supports.length > 0 ? `: ${supports.join(', ')}` : ''}`) : ['- none']), '');
    if (compile) {
      // D-521 (§17): the round's changes within the budget, its finds over it, and each target the budget can't reach
      // with what reaching it would cost.
      const changes = tradeLines({ ...r, trades: objects(r.trades).filter((t) => !['scaling', 'boots'].includes(t.kind)) }, rec);
      const over = overBudgetLines({ ...r, trades: [] }, rec, finds);
      const missed = notReachedLines(r, gate, rec);
      if (changes.length > 0) out.push('**Changes**', ...changes, '');
      if (over.length > 0) out.push('**Over budget**', ...over, '');
      if (missed.length > 0) out.push('**Not reached within your budget**', ...missed, '');
      continue;
    }
    const over = overBudgetLines(r, rec, finds);
    if (over.length > 0) out.push('**Over budget**', ...over, '');
    // D-522 (§18): the placed rung keeps the character's design; its targets not reached are findings, with their cost.
    const placed = fileRun && isObj(st.source) ? notReachedLines(r, gate, rec) : [];
    if (placed.length > 0) out.push('**Not reached on this rung**', ...placed, '');
  }
  out.push(`**The catch.** ${text(summary.catch) ? stop(summary.catch) : 'not given'}`, '');
  // D-521: a compile run's better round, its draft named first (above): accept runs F1, ask for changes, or stop.
  out.push(pieceOf(log) === 'compile' ? INVITE4.better : fileRun ? (s.scope === 'better' ? INVITE4.fileBetter : INVITE4.fileLadder) : INVITE4.design14, '', '**Options**');
  return out;
}

function designDisplay(dir, log, id, opts = {}) {
  const s = lastStage(log, ['D1-gate'], id);
  if (!s) return [id ? `No D1 gate for ${id} in the run log.` : 'No D1 gate in the run log.'];
  const file = verdictFile(s);
  const gate = readJson(dir, file);
  if (!isObj(gate?.design)) return [`${file} has no design field.`];
  const folder = folderOf(log, s.concept);
  // D-478 (amendment 14, §25): a build whose last D1 gate ran at or after 14's boundary shows the [GR] form; --detail
  // prints today's measurement lines.
  const held14 = log.stages.indexOf(s) >= heldFrom(log, 'stages', A14);
  if (held14 && opts.detail !== true) {
    return designDisplay14(dir, log, s, gate, readJson(dir, inFolder(folder, 'plan.json')), gateRecord(dir, gate, folder), folder);
  }
  const plan = readJson(dir, inFolder(folder, 'plan.json'));
  const { name } = cardsOf(dir);
  // D-407: the D1 gate's record (its recordPath) gives each rung's movement speed and the clear skill's no-area flag.
  const record = gateRecord(dir, gate, folder);
  // §19: a design field written under amendment 11 shows each rung's two figures and its trades, from its new entries;
  // one written before a resume's stamp keeps its old form.
  const a11 = designA11(gate.design);
  // Amendment 12 (§22): a design field with `maxHit` or the resisting figure shows the Arbiter's deciding row, the lowest
  // max hit, the resisting figure, the non-budget rung's toughness reading and the new trades; the floor from the targets file.
  const a12 = designA12(gate.design);
  // Amendment 13 (§22): a design field with Appendix A's additions shows the boss rotation, Life, the swap cap, an undone
  // rebuild, the removed passives and the skill levels, from its own fields.
  const a13 = designA13(gate.design);
  const floor = arbiterFloor() ?? ARBITER_FLOOR;
  const out = [`The endgame build for ${name(s.concept)}, rung by rung, as its last design check measured it. ${a12 ? PACE_FIRST_A12 : a11 ? PACE_FIRST_A11 : PACE_FIRST}`, ''];
  // D-466 (Appendix A): the draft's one home is the run log's builds[].draftFile; its name, once.
  // D-521: a compile run has no builds[]: its draft is the gate's, or an escalation accept's (`compileDraft`).
  const draft = pieceOf(log) === 'compile' ? compileDraft(log, s, gate) : objects(log.builds).find((b) => b.id === s.concept)?.draftFile;
  if (text(draft)) out.push(`- Draft PoB file: ${baseName(draft)}, in your builds list.`, '');
  // D-434: the build's pieces, once, before the rungs: the D1 gate's design field `pieces`, read from pieces.md.
  if (isObj(gate.design.pieces)) out.push(piecesLine(gate.design.pieces, a11), '');
  for (const r of objects(gate.design.rungs)) {
    const rec = record?.stages?.[r.stage];
    const measured = rec?.measures?.clearSpeed;
    // D-407: the pace leads (the gate's clear-speed word, or the record's speed when PoB gives the skill no area), then
    // the boss floor, the Arbiter check, then damage and effective HP.
    out.push(`${rungLabel(plan, r.stage)}:`);
    out.push(`- Clear speed: ${noArea(measured) ? clearPhrase(measured) : `${speedOf(typeof r.clearSpeed === 'string' ? r.clearSpeed : measured)} (rough)`}.`);
    // D-427: the travel skill beside the movement speed, from the record's clear measure.
    out.push(`- Movement speed: ${moveWords(moveOf(rec))}${travelWords(measured)}.`);
    // D-449 (amendment 12): a b or n rung's Arbiter line from its deciding row, its lowest max hit and PG-100's note.
    if (a12 && isObj(r.maxHit)) out.push(...arbiterLines12(r, rec, floor));
    else if (r.arbiter !== null && r.arbiter !== undefined) out.push(`- The Arbiter of Divinity: ${arbiterWords(r.arbiter).replace(/^survives the Arbiter of Divinity's hits/, 'survives its hits').replace(/^one-shot by the Arbiter of Divinity's /, 'one-shot by its ')}.`);
    // D-437, D-447: the named source's figure against map monsters, then the boss figure (§19: a design field from before
    // amendment 11 has `dps` alone).
    if (isObj(r.damage)) out.push(...damageLines(r, sourceSkill(plan, rec, r.stage)));
    else out.push(`- Damage: ${whole(r.dps)} per second.`);
    // D-468 (amendment 13): the boss rotation, each entry's start, end and final figure, and the designer's reason.
    if (a13) out.push(...bossRotationLines(r));
    // D-423: the Effective HP line names the hit it was measured against (the rung's `ehpHit`), so it compares with
    // the dossier's EHP at the verification gate. D-449: on n, the share of it chance layers make.
    if (!(a12 && isNum(r.toughness?.chanceShare))) out.push(`- Effective HP: ${whole(r.ehp)}${text(r.ehpHit) ? ` (against ${r.ehpHit.trim()})` : ''}.`);
    else out.push(`- Effective HP: ${whole(r.ehp)}${text(r.ehpHit) ? ` (against ${r.ehpHit.trim()})` : ''}; ${Math.round(r.toughness.chanceShare)}% of it from chance layers (evade, block, deflection).`);
    // D-441: the non-budget rung's EHP against its target, with the engagement and the band; D-449, then its
    // conditioned read, the ailment line and the warning.
    if (isObj(r.toughness) && isNum(r.toughness.target)) out.push(toughnessLine(r), ...(a12 ? toughnessLines12(r) : []));
    // D-467 (amendment 13): Life at D1-tree's start and end, shown though it isn't a target.
    if (a13 && isObj(r.life)) out.push(`- Life on ${r.stage}: ${whole(r.life.start)} → ${whole(r.life.end)} (EHP and the lowest max hit held their start).`);
    for (const [k, label] of [['anoint', 'Anoint'], ['gear', 'Gear'], ['gems', 'Gems'], ['tree', 'Passive tree']]) if (text(r[k])) out.push(`- ${label}: ${r[k]}`);
    // D-419: schema 4's tree is the node-power summary, its needs one line each.
    if (isObj(r.tree)) out.push(...treeLines(r.tree, swapLabel(a11, r.tree, plan, r.stage)));
    // D-467, D-473 (amendment 13): the swap cap, an undone rebuild, the removed passives and the skill levels.
    if (a13) out.push(...searchLines(r));
    // D-439…D-441, D-448, D-450: the trades the user may take or leave.
    out.push(...tradeLines(r, rec));
    // D-521 (§17): a better round's targets the budget can't reach, with what reaching them would cost.
    if (pieceOf(log) === 'compile') out.push(...notReachedLines(r, gate, rec).map((l) => l.replace(/^- /, '- Not reached within your budget: ')));
    out.push('');
  }
  // An estimate the gate wrote for one rung (`b: …`) names the rung in words.
  const ids = new Set(objects(gate.design.rungs).map((r) => r.stage));
  const estimates = (Array.isArray(gate.design.estimates) ? gate.design.estimates.filter(text) : []).map((e) => e.replace(/^(\w+):\s*/, (m, rung) => (ids.has(rung) ? `${rungLabel(plan, rung)}: ` : m)));
  if (estimates.length > 0) out.push('Still estimates:', ...estimates.map((e) => `- ${e}`), '');
  // D-480 (amendment 14): a build held to 14 asks guide or file at its accept, in --detail too.
  out.push(verdictWords('D1-gate', gate.verdict), '', pieceOf(log) === 'compile' ? INVITE4.better : isFileRun(log) ? (s.scope === 'better' ? INVITE4.fileBetter : INVITE4.fileLadder) : log.schemaVersion === 4 ? (held14 ? INVITE4.design14 : INVITE4.design) : INVITE.design);
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
  const pobLine = `Your PoB file: ${d2gate?.finalCompile?.pobFile ?? "none: the final compile didn't run"}`;
  const out = [
    `The guide${card ? ` for ${name(card)}` : ''}: ${at('guide.md')}`,
    `Its audit, how each number was checked: ${at('audit.md')}`,
  ];
  // D-478, D-479 (amendment 14): a build held to 14 by its last D1 gate prints its PoB file first.
  if (d1 && log.stages.indexOf(d1) >= heldFrom(log, 'stages', A14)) out.unshift(pobLine);
  else out.push(pobLine);
  // D-466 (Appendix A): the draft F1 couldn't remove (changed on disk, or not this build's), its verdict's `draftLeft`.
  const f1 = lastStage(log, ['F1'], card);
  const left = f1 ? readJson(dir, verdictFile(f1))?.draftLeft : null;
  if (text(left)) out.push(`Your draft PoB file stays: ${baseName(left)}, which F1 didn't remove: it changed on disk, or this build didn't write it.`);
  out.push('');
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
  out.push(`- The run checker: ${Array.isArray(checker) ? (checker.length === 0 ? 'it found no problem' : `it found ${checker.length} problem(s), listed under For reference`) : "it didn't run"}.`);
  // D-435: the checker's warnings, a server build older than its source among them, so a violation may be the stale build's.
  const warnings = Array.isArray(checker?.warnings) ? checker.warnings.filter(text) : [];
  if (warnings.length > 0) out.push(`- The run checker also warns: ${warnings.length === 1 ? 'one warning' : `${warnings.length} warnings`}, listed under For reference; a problem it found may come from the warning's cause.`);
  out.push('');
  // D-369: each endgame rung's figures from the final record, and the design gate's where they moved since.
  const plan = readJson(dir, inFolder(folder, 'plan.json'));
  const record = readJson(dir, inFolder(folder, 'compile-record.json'));
  const atDesign = new Map(objects(d1gate?.design?.rungs).map((r) => [r.stage, r]));
  // D-437: a record carrying `measures.damage` gives each rung its two figures; an older record its one (§19). D-454
  // (amendment 12): one carrying `measures.damage.resisting` gives the resisting figure between them.
  const twoFigures = objects(plan?.stages).some((x) => typeof x.variant === 'string' && isObj(record?.stages?.[x.id]?.measures?.damage));
  const threeFigures = objects(plan?.stages).some((x) => typeof x.variant === 'string' && isNum(record?.stages?.[x.id]?.measures?.damage?.resisting));
  out.push(`The endgame, from the final build. ${threeFigures ? FIGURES_MEAN_A12 : twoFigures ? FIGURES_MEAN_A11 : FIGURES_MEAN}`);
  // D-459: the verdict label's three forms read the deciding row against the floor in the targets file.
  const floor = arbiterFloor() ?? ARBITER_FLOOR;
  const rungIds = [];
  for (const variant of RUNGS) {
    const st = objects(plan?.stages).find((x) => x.variant === variant);
    if (!st) continue;
    rungIds.push(`${rungLabel(plan, st.id)}: ${st.id}`);
    const rec = record?.stages?.[st.id];
    const m = rec?.measures ?? {};
    // D-447: the boss figure is the record's evaluated `boss_<stage>` when the plan estimates one, else PoB alone.
    const estimate = objects(plan?.ledger).some((e) => e.id === `boss_${st.id}`);
    const two = isObj(m.damage) ? { map: m.damage.map, resisting: m.damage.resisting, boss: estimate ? record?.ledger?.[`boss_${st.id}`]?.value : bossFigure(st.id, plan, rec, {}), about: estimate } : null;
    const now = rungWords({ dps: m.dps, ehp: m.ehp, two, arbiter: variant === 'entering-maps' ? null : (m.arbiter ?? 'not measured'), clearSpeed: m.clearSpeed }, floor);
    // D-419: each rung's travel beside its figures, from the last D1 gate verdict file.
    const tree = atDesign.get(st.id)?.tree;
    out.push(`- ${rungLabel(plan, st.id)}: ${now}${isObj(tree) && isNum(tree.travel) ? `, ${tree.travel} of ${isNum(tree.points) ? tree.points : '?'} passive points on travel` : ''}.`);
    const then = atDesign.get(st.id);
    if (then) {
      const b = isObj(then.boss) ? then.boss : null;
      const thenTwo = isObj(then.damage) ? { map: then.damage.map, resisting: then.damage.resisting, boss: isNum(b?.estimate) ? b.estimate : (b?.measured ?? then.damage.boss), about: isNum(b?.estimate) } : null;
      // D-459: a design field written under amendment 12 gives its Arbiter by its deciding row, `maxHit`.
      const arbiter = variant === 'entering-maps' ? null : isObj(then.maxHit) ? then.maxHit : then.arbiter;
      const was = rungWords({ ...then, two: thenTwo, arbiter }, floor);
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
  out.push('', "What's still open, the guide's known issues:", ...(issues.length > 0 ? issues : ['None.']), '', isFileRun(log) ? INVITE4.fileFinal : log.schemaVersion === 4 ? INVITE4.final : INVITE.final);
  const ref = [];
  for (const [s, g] of [[d1, d1gate], [d2, d2gate]]) if (s) ref.push(`${s.stage}: ${parts(g?.verdict)} (${verdictFile(s)})`);
  if (rungIds.length > 0) ref.push(`Rungs: ${rungIds.join(', ')}`);
  if (unknown) ref.push('Unknown totals: D-164');
  if (Array.isArray(checker)) ref.push(checker.length === 0 ? 'Run checker: ok' : `Run checker: ${checker.length} violation(s)`, ...checker.map((v) => `  [${v.rule}] ${v.message}`));
  else ref.push(`Run checker: didn't run (${checker?.message ?? checker})`);
  for (const w of warnings) ref.push(`Run checker warning: ${w}`);
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
  // Information-only findings (gates.md): the chaos exception, an over-target price and a boots exception (D-440).
  const findings = objects(gate?.findings).filter((f) => failing.includes(f.part) && !['chaos-exception', 'over-target', 'boots-exception'].includes(f.code));
  const why = failing.length > 0 ? failing.map((k) => PART_WORDS[k]?.fail ?? `${k} failed`).join('; ') : 'its verdict file names no failing part';
  const first = findings[0]?.message;
  const what = GATE_WHAT[s.stage] ?? s.stage;
  return [
    `${what} for ${name(s.concept)} failed ${failed} ${failed === 1 ? 'time' : 'times'}, so the run stops to ask you. What failed: ${why}${text(first) ? `: ${plain(first)}` : ''}${findings.length > 1 ? ` (and ${findings.length - 1} more, under For reference)` : ''}.`,
    '',
    // D-521: a compile run has no verification gate to go back to.
    pieceOf(log) === 'compile' || isFileRun(log) ? INVITE4.betterEscalation : INVITE.escalation,
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
export async function display(runFolder, gate, build, opts = {}) {
  if (!DISPLAYED.includes(gate)) throw new Error(`display: ${JSON.stringify(gate)} isn't one of ${DISPLAYED.join(', ')}`);
  // D-478 (amendment 14): `--detail` prints the design gate's measurement lines, today's display, on request.
  if (opts.detail === true && gate !== 'design') throw new Error(`display: --detail goes with the design gate, not ${gate}`);
  const file = path.join(runFolder, 'run-log.json');
  const log = readLog(file);
  // D-411, D-412: in schema 4 the design and final gates are a build's, named with --build <id>; no other gate is.
  const perBuild = ['design', 'final'].includes(gate);
  const piece = pieceOf(log);
  if (log.schemaVersion !== 4 && build !== undefined) throw new Error('display: --build is schema 4\'s (amendment 9); this run log is schema 3');
  // D-516: a compile run's better round has the design gate and the escalation question, its one build file at the root;
  // no other piece run has a gate.
  if (piece !== null && (piece !== 'compile' || !['design', 'escalation'].includes(gate))) throw new Error(`display: a ${piece} run has no ${gate === 'escalation' ? 'escalation' : `${gate} gate`}; only a compile run's better round has gates, its design gate and its escalation question (D-516)`);
  if (piece !== null && build !== undefined && (gate !== 'design' || build !== FILE_ID)) throw new Error(`display: a compile run's one build is ${FILE_ID}, at the folder's root: display design, or display design --build ${FILE_ID} (D-516)`);
  // D-522 (§18): a file run has no brainstorm or verification gate, so no display of one (`fileRunGates`).
  if (isFileRun(log) && ['brainstorm', 'verification'].includes(gate)) throw new Error(`display: a run from a PoB file has no ${gate} gate: the file is its skeleton and cards/${FILE_ID}.md its card; a resume goes on from where it stopped (D-522)`);
  if (piece === null && log.schemaVersion === 4 && perBuild && build === undefined) throw new Error(`display: the ${gate} gate is a build's: display ${gate} --build <card id> (D-411)`);
  if (build !== undefined && !perBuild) throw new Error(`display: --build goes with the design and final gates, not ${gate}`);
  if (piece === null && build !== undefined && !objects(log.builds).some((b) => b.id === build)) throw new Error(`display: ${build} has no build in the run; builds[] holds ${objects(log.builds).map((b) => b.id).join(', ') || 'none'}`);
  const visit = (Array.isArray(log.checkpoints) ? log.checkpoints.filter((c) => isObj(c) && c.checkpoint === gate).length : 0) + 1;
  const body = await DISPLAYS[gate](runFolder, log, piece !== null && gate === 'design' ? FILE_ID : build, opts);
  if (!Array.isArray(log.displays)) log.displays = [];
  if (!log.displays.some((d) => isObj(d) && d.checkpoint === gate && d.visit === visit)) {
    // D-475 (amendment 13, Appendix A): the brainstorm display's number-to-id map, so the runner maps the user's numbers.
    log.displays.push({ checkpoint: gate, visit, ...(isObj(body.numbers) ? { numbers: body.numbers } : {}) });
    saveLog(file, log);
  }
  const title = gate === 'escalation' ? `## Escalation, visit ${visit}` : `## The ${gate} gate, visit ${visit}`;
  return `${[title, '', ...body].join('\n')}\n`;
}

async function main(argv) {
  const args = argv.slice(2);
  // Amendment 14 (Appendix A): `skeleton` and `answer-change` (D-479, D-480).
  const kinds = ['init', 'stage', 'checkpoint', 'escalation', 'set', 'build', 'resume', 'pricing', 'skeleton', 'answer-change', 'display', 'test-config', 'migrate'];
  // D-478: `display design --build <id> --detail` prints today's design display.
  const detail = args[1] === 'display' && args.length === 6 && args[3] === '--build' && args[5] === '--detail';
  const displayBuild = args[1] === 'display' && (args.length === 5 || detail) && args[3] === '--build';
  if (!kinds.includes(args[1]) || (args[1] === 'migrate' ? args.length !== 2 : args.length !== 3 && !displayBuild)) {
    process.stderr.write(`usage: node run-log.mjs <runFolder> <${kinds.slice(0, -3).join('|')}> '<json>' | -  (- reads the JSON from stdin), <runFolder> display <${DISPLAYED.join('|')}> [--build <card id> [--detail]], <runFolder> test-config <path>, or <runFolder> migrate\n`);
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
      process.stdout.write(await display(path.resolve(args[0]), args[2], displayBuild ? args[4] : undefined, { detail }));
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
    // D-507: init and resume print the running leagues' digests, which the runner copies into the headers' `digests`
    // and prints as the staleness line.
    const digests = ['init', 'resume'].includes(args[1]) ? digestReport().map((l) => `${l}\n`).join('') : '';
    process.stdout.write(`run-log: wrote ${what}\n${digests}`);
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
