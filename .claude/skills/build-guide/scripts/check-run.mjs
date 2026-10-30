#!/usr/bin/env node
// The build-guide run checker (slice 03 FR-W7, as amendments 1 to 3 change it).
//
//   node .claude/skills/build-guide/scripts/check-run.mjs <runFolder>
//   node .claude/skills/build-guide/scripts/check-run.mjs <runFolder> --snapshot <n> [--build <card id>]
//   node .claude/skills/build-guide/scripts/check-run.mjs <runFolder> --changed <n> [--build <card id>]
//
// A schema-4 run (amendment 9) keeps each build in its folder, `builds/<id>/` ("." for a migrated run's build): its
// round copy and its comparison take `--build <card id>`, and are that folder's `rounds/<n>/`.
//
// `--snapshot <n>` makes the round copy (A-34): plan.json, compile-record.json and guide.md into rounds/<n>/,
// never over an existing round. `--changed <n>` prints what changed since rounds/<n>/ (D-352), one line each and
// nothing else: `claim stages[<i>].claims[<k>] (<id>)` for a claim whose text, source or cited record values
// changed, and `section <H2 title>` for a changed guide H2 (`changedSince` says what a source cites). Both exit
// 0, or 1 with the reason on stderr.
//
// Without a flag, it checks what the run folder holds, whatever the run's status; once a guide exists, every guide check
// applies. It checks the artifacts rather than self-reports:
//  - the layout (slice 03 §2): the cards `cards/<id>.md`, the deck `cards.md`, the probe variants
//    `probes/<card-id>/<n>/` (D-338), the round copies `rounds/<n>/` (A-34) and the V4 reports
//    `reports/V4-<n>.md` (D-352); each card's probes at most 4 (D-292); the deck's rounds of 6–9 dealt cards with
//    at least two under-played ones, or the short round's reason (D-287, D-339); the source markers (§7.3); the
//    dossier, one table of the verification gate's comparison (D-355); every plan claim's `kind` (D-351);
//  - amendment 2's guards on the reader layer (D-276, D-283): the 3,000-word cap, the 14 H2s, no marker,
//    confidence label or finding id in guide.md, one fixed-form verdict line per endgame rung compared with the
//    record (its hits the compiler wrote, D-353; its Effective HP against `TotalEHP`, D-294; on `b` and `n` its
//    survival label the record's Arbiter verdict, D-353), reward picks by name, Known issues by sentence with
//    their ids in audit.md; audit.md and each rung's Checks block equal to `render-audit.mjs`'s render, Known
//    issues aside (D-355); and the entering-maps rung's floor (D-281);
//  - the final record against the plan (`planSha1`, or after claims-only edits its `buildSha1`, computed with
//    the server's compiled projection, which leaves out the claims, the sources and the ledger, D-264, D-266,
//    D-352), its PoB file (the decoded import code, one tree set per plan stage) and the ledger: the plan's
//    current formulas, evaluated over the record with the server's own compiled evaluator, and the claims that
//    cite them (D-365);
//  - the D1 gate, recomputed from the plan and the record: the floor (the reference hits the compiler wrote,
//    D-353), the budget (every filled slot and tree jewel priced, D-249; the market, each rung's total range at
//    its price day and the over-target findings from data/economy/prices.json, D-370, D-373; `pass` or
//    `unverified`, never a failure, D-371), and the named damage source (the part `rolledSkill`, D-295) with its
//    figure's stat set, each figure read × its Count where the record has a counted copy (D-340);
//  - the V4 reports (D-352): one per pass, never overwritten; a re-check covers every item `--changed` lists;
//    every finding open in the last report listed under the guide's `Known issues`, and every campaign reward
//    choice the campaign passes picked in the plan and named in the guide (D-265);
//  - the run log (schema version 3, D-289; schema 2 only so recorded runs still check, D-326) and the control
//    flow it records, which stands in for the workflow harness tests amendment 1 deleted: steps in a legal
//    order, each gate's answer followed (the brainstorm, verification, design and final gates, D-287, D-362),
//    the caps per brainstorm and verification round, the retry caps (S6 honoured; an R1b `not-a-skill` or
//    `wrong-ascendancy` failure is terminal, D-334, D-342), one full V4 pass per guide and at most one re-check
//    per fix round or revision, escalations only from the gates, the rule on every pre-supplied or default
//    answer, and each gate visit's display recorded before its answer (D-367).
//  - amendment 7's gates as interviews (D-389…D-392): each gate checkpoint's `questions` against its visit's interview
//    notes `interviews/<gate>-<visit>.md`, the gate question steps (`Q`) against their reports
//    `interviews/<gate>-<visit>-q<n>.md` (D-390), the checkpoint's `changes`, `newCards` and `note` in their forms, a
//    changed card's "Changed at the gate" line, a card made at a gate (`r<k>-g-<n>`) with its "Made at the gate" line
//    and its deck line, verified in the same round after the picked cards (D-391), and the deck's header (D-392).
//  - amendment 8's engine lens (WU-89, D-400…D-408): the rival's step `RV` and its card `r<k>-x-<n>` (D-408), once per
//    run right after the first verification round's assembly, its R1b outside that round's cap of 3 and a second
//    R1b-assemble pass for its dossier row; the terminal R1b codes `not-in-pin` (D-400) and `not-dealt` (the rival's
//    identity and sniff checks, D-408); the deck line's `engine: <family> from <family>` in data/rules/vocabulary.md's
//    words, at most half a round's dealt cards on one engine unless the round is short for that reason or the user's
//    note for it names that engine, and the header naming each engine and its count (D-405); `waits on the pin:
//    <entry>` on a card that can't be finalized yet (D-400); the obvious card's `Obvious build:` (D-403); the structure
//    check's `A stronger structure?` as its last line (D-406); the dossier's clear-speed column (D-407); and a `data`
//    citation to a Markdown data file by its entry id (`### <Name>` then `- Id: <id>`; in rules/nodes.md, a node line by
//    its node id), in a research file's footnotes only: a plan citing one fails, since compile_plan refuses it. The
//    formats: docs/build-guide/studies/2026-10-18-wu89-formats.md.
//
//  - amendment 9's schema 4 (WU-94, D-411…D-424): the run log's builds[], resumes[], noNinja, pin commit, digest and
//    run-wide dossier (D-412); each build's artifacts in its folder, held to its card's steps, a build in "." read as
//    the root's (`checkBuild`); the PoB file `<slug>-<YYYY-MM-DD>-<n>-<card id>`; the guide by the template its plan
//    decides, the endgame guide's 12 H2s, its 2,300-word cap and its reward picks named in Switching over, and the log's
//    `guide` field agreeing with the plan (D-413, D-414); the D1 gate's `tree` part, its shape and its agreement with
//    its findings (D-419); F1's verdict files (the D2 gate's shape) and its ledger refusal (`ledger-refused`); V4's
//    campaign pass (`V4-campaign`, H1 `campaign pass of rounds/<n-1>`, D-415); the control flow per build
//    (`checkFlow4`): the queue, D1-tree, F1 and its escalation, the final gate's campaign and accept:verification, a
//    decline, the resume's answers and the entries after a run's end placed by each resume's lengths, a refused call
//    re-run next (D-421); `## Pending decision` exempt in the interview notes (D-420); the deck's "How they differ" one
//    paragraph (D-424).
//  - amendment 10 (WU-105, D-429…D-435; its Appendix A): the brainstorm round's synthesis `R1a-synthesize` (schema 4),
//    never mixed with `R1a-assemble` in one run, a run keeping the step its first round used; the composite `r<k>-s-<n>`;
//    the composite deck (`checkCompositeDeck`): its H2s, 1–4 composites a round, short with fewer than 2 or with none
//    taking an under-played piece, then only with its shortReason, `## Cards` listing every card but the composites
//    with the composites each fed, `## Pieces not used`, `## Not composed`, `## Superseded`; a composite (any card with
//    `### Pieces`) and its tables (`checkPieceTables`): an out or scheduled piece's reason, its `### Pieces measured`
//    once it counts as verified (its structure check holds more than `Not checked yet.`, or R1b passed), `not measured
//    (<why>)` rows; its probe cap 8, a plain card's 4; a composite run's dossier
//    with the twelfth column `key pieces`; `pieces.md` in a build's folder (D-434); `builds[].name` (D-435); an empty
//    list item in a V4 report ignored; and the result's `warnings`, a server build older than its source under
//    `src/plan/` (its directory `BUILD_GUIDE_SERVER_BUILD` when set, for tests), the violations still reported.
//  - amendment 11 (WU-113; D-436…D-448, its Appendix A), for the entries a log is held to its rules (§19: all of them
//    when init wrote `skillRevision: 11`, those after the stamp when a resume wrote it, none in an older run's log):
//    the dossier's nine columns (`DOSSIER_COLUMNS_A11`: Damage and Pieces, no number; `viable, except` with a piece that
//    does nothing), a card's `| Key | Left out by | Does something |` table (`in` rows only, its answers held to R1b's
//    `pieces[]` drops), an R1b `damage-missing` attempt failing though it compiled; the D1 gate's design field
//    (`checkDesignField`: the record's two figures, the cull only with `skills.cull`, the trigger, the toughness band
//    recomputed from the record's TotalEHP, the plan's engagement and references/toughness-targets.json, the boss estimate
//    the ledger's `boss_<stage>`, the floor references/boss-floor.json's and `under` the boss figure below it, the rung's
//    trades trades.json's, a trade for a rung out of band or under the floor, a damage trade's `bossAfter`), the
//    non-budget rung's engagement, the `boss_<stage>` formula's rotation references (`checkBossLedger`); the guide's verdict
//    line with two figures once the record measures them; `trades.json` in a build's folder (`checkTradesFile`); the
//    order table's D1-tree `respec` and D1-finish `build` routes to D1-build, and the D1 gate's re-price pass after the
//    design gate's retry-pricing; `bestSwap.weaponSet` 1 or 2 and `branches`; the tree part's swap messages in "damage"
//    (D-437; an older verdict's keep "Full DPS"); `boots-exception` information only; the
//    pricing stops and retries (`checkPricing`, D-444) and D1-build's `priceOutcomes`; no rival (D-443); and a run dated
//    amendment-8-or-later by its skill revision, as by its rival. The ledger's context carries each stage's
//    `bossGroups` and `damageBoss`, for C-33's `<stageId>.boss.…` references.
//  - amendment 12 (WU-121; D-449…D-454, D-459, its §22 and Appendix A): revisions compare by order, not equality, each
//    one's rules from its own boundary (`skillRevision` 11 or 12; `skillRevisionFrom` amendment 11's flat lengths on a
//    log at 11, one boundary per revision on a log at 12), a build held to the rules of its last D1 gate. For a build
//    whose last D1 gate is held to 12 (`checkDesignField12`): the design field's `maxHit` on `b` and `n` (the deciding
//    row, `oneShot` by the floor in references/toughness-targets.json, the lowest max hit), `damage.resisting` on each
//    variant rung, and on `n` the toughness reading (`chanceShare`, `conditioned` and its band, `ailmentCut`, the
//    warning), each recomputed from the record while the gate is fresh; the record's rows' hits survived within Names'
//    rule; a one-shot rung's defence trade, a damage trade there that keeps its max hit, an evasion build's avoidance
//    trade on `b` and `n`; `trades.json` in its revision's fields (9 at 12, 7 before: `TRADE_FIELDS`); a schema-8 plan's
//    `n` with its defence plan; no D1-tree `respec` from 12's boundary on. By the record, whatever the revision: the
//    guide's verdict line with three figures once the record measures the resisting figure, its label in the three
//    forms once the record's rows carry hits survived, and its tree-change line against `treeChange`.
//
// Node built-ins only, plus the server's compiled ledger module `build/plan/ledger.js` (its imports are
// type-only, so it loads alone; amendment 1 §6 relaxes FR-W7's built-ins rule for it), its build projection
// `build/plan/buildHash.js` (D-266; it imports only crypto) and the audit render beside this file,
// `render-audit.mjs` (D-355). No network.
//
// Exit 0: every check passed (one line on stdout). Exit 1: each violation on stderr as
// `check-run: [<rule>] <message>`. Exit 2: usage error. Either way, each warning (D-435) goes to stderr first, as
// `check-run: warning: <message>`.
//
// The shapes it reads are documented in ../references/ (run-folder.md, run-log.md, gates.md,
// source-markers.md, pricing.md, stages/V4.md) and ../templates/; keep them in step with this file.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  loadAuditInputs, renderAudit, checksBlocks, priceTable, marketOf, rungBudget, roundDivines, PRICE_DAY, M_TARGET, ledgerStage,
  arbiterFloor, ARBITER_FLOOR, arbiterReading, arbiterLabel12, hasHitsSurvived, survivedOf, typeWords,
  divinesOf, ratesOf, pinnedSlots, FLASK_SLOT,
} from './render-audit.mjs';
import {
  parseCard, parseDeck, DECK_HEADER, DECK_FOOTER, MADE_MARK, RIVAL_CARD, CANT_FINALIZE, inFolder,
  COMPOSITE_HEADER, COMPOSITE_FOOTER, SUPERSEDED, COMPOSITE_CARD, RESEARCHER_CARD, PIECE_KEY, PIECES_COLUMNS, MEASURED_COLUMNS,
  PIECE_KINDS, PIECE_STATUSES, ASSEMBLY_STAGES, emptyCell,
  MEASURED_COLUMNS_A11, DOES_SOMETHING, SKILL_REVISION, A11, A13, REVISIONS, heldFrom, openStop, stopOutcome, STOP_OUTCOMES, RETRY_ANSWERS, EXCHANGE, PACE, referenceJson,
  swapLabel, revisionOf,
} from './run-log.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
/** The repository root: .claude/skills/build-guide/scripts -> the root. */
const REPO = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
/** The repo's C1/E1 data (C-35). */
const DATA_DIR = path.join(REPO, 'data');
/**
 * The server's build directory: the repository's `build/`, or for tests `BUILD_GUIDE_SERVER_BUILD` when it is set
 * (D-435); its sources are `src/` beside it.
 */
const serverBuild = () => (process.env.BUILD_GUIDE_SERVER_BUILD ? path.resolve(process.env.BUILD_GUIDE_SERVER_BUILD) : path.join(REPO, 'build'));
/** The server's compiled ledger evaluator (C-33), the one `compile_plan` fills the record with. */
const ledgerModulePath = () => path.join(serverBuild(), 'plan', 'ledger.js');
/** D-266: the server's compiled build projection, the one the compiler writes the record's `buildSha1` with. */
const buildHashModulePath = () => path.join(serverBuild(), 'plan', 'buildHash.js');

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
/**
 * D-414, the endgame guide (`templates/guide-endgame-template.md`), for a plan with no campaign stage: its 12 H2s, in
 * order (amendment 9 §8). Leveling, Campaign route and rewards, and Gem and ascendancy timing give way to Switching over.
 */
export const ENDGAME_GUIDE_H2 = [
  'At a glance',
  'Your PoB file',
  'Switching over',
  'Survival by stage',
  'Priorities',
  'Endgame: entering maps',
  'Endgame: budget',
  'Endgame: non-budget',
  'How to play it',
  "What PoB can't show",
  'FAQ',
  'Changelog',
];
/** D-414: the endgame guide's word cap (the full guide's stays WORD_CAP), the H1, the import code and Known issues aside. */
const ENDGAME_WORD_CAP = 2300;
/** D-414: the endgame guide's H2 that names each campaign reward pick D1 makes (D-413). */
const SWITCHING_H2 = 'Switching over';
/** §7.8, the audit layer as `render-audit.mjs` renders it (D-278, D-355): audit.md's H2s, in order. */
export const AUDIT_H2 = ['Estimates', 'Stage detail', 'Checks', "What PoB doesn't model", 'Inputs by confidence', 'Known issues'];
/**
 * §7.2 as D-355 reduces it: the dossier's one table, the verification gate's comparison, these columns in order. A run
 * that ran the rival (amendment 8) writes `DOSSIER_COLUMNS_D407` instead; a dossier from before it keeps these.
 */
export const DOSSIER_COLUMNS = ['Card', 'Round', 'Status', 'Synergy', 'Named source DPS', 'Life', 'EHP', 'Key prices', 'League', 'Main risk'];
/** D-407, D-408: amendment 8's dossier, with each card's rough clear speed after its EHP. */
export const DOSSIER_COLUMNS_D407 = ['Card', 'Round', 'Status', 'Synergy', 'Named source DPS', 'Life', 'EHP', 'Clear speed', 'Key prices', 'League', 'Main risk'];
/**
 * D-433: a composite run's dossier (one whose brainstorm rounds R1a-synthesize composed), with a twelfth column, `key
 * pieces`: each measured piece and its largest drop, with the figure it falls on, from the card's Pieces measured.
 */
export const DOSSIER_COLUMNS_D433 = ['Card', 'Round', 'Status', 'Synergy', 'Named source DPS', 'Life', 'EHP', 'Clear speed', 'Key prices', 'League', 'Main risk', 'key pieces'];
/**
 * D-436 (amendment 11, Appendix A): a dossier written under amendment 11's rules: no number column; `Damage`, the damage
 * kinds PoB shows for the named source, and `Pieces`, how many of the `in` pieces probed do something.
 */
export const DOSSIER_COLUMNS_A11 = ['Card', 'Round', 'Status', 'Synergy', 'Damage', 'Pieces', 'Key prices', 'League', 'Main risk'];
/** The dossier cells a failed or not-yet-finalizable card leaves `—`: its numbers, its clear speed, its prices, its league and its key pieces; amendment 11's damage kinds. */
const DOSSIER_EMPTY_CELLS = ['Named source DPS', 'Life', 'EHP', 'Clear speed', 'Key prices', 'League', 'key pieces', 'Damage'];
/** D-436 (Appendix A): an amendment-11 dossier's Status: `viable`, `viable, except <what>`, `failed after <N> attempts: …` or `can't be finalized yet: …`. */
const STATUS_A11 = /^(?:viable|viable, except \S.*|failed after [1-9]\d* attempts?: \S.*|can['’]t be finalized yet: \S.*)$/;
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
/** D-352: a V4 finding id `v4-<n>-<k>`, `<n>` the report that raised it. */
const FINDING_ID = /\bv4-\d+-\d+\b/;

const SOURCE_KINDS = ['pob-computed', 'pob-data', 'external', 'judgment', 'external-unavailable'];
const EXTERNAL_UNAVAILABLE_REF = 'external source unavailable (offline run)';
const NEEDS_CONFIDENCE = ['external', 'judgment', 'external-unavailable'];
const OFFLINE_NOTE = 'offline run';

/** `TradeErrorKind` (src/trade/errors.ts), the `<kind>` of a `[trade:<kind>]` error prefix (D-218). */
const TRADE_KINDS = [
  'no_session', 'session_rejected', 'too_complex', 'invalid_query', 'rate_limited', 'locked_out',
  'would_wait', 'auth', 'http', 'network', 'timeout', 'disabled',
];
/**
 * A `priceOutcomes` key: `ok`, `error` (no prefix) or a trade kind; D-444: `exchange`, a call poe.ninja's currency exchange
 * priced; D-474: `pace`, the trade call whose reply had no pace line or the pace off.
 */
const PRICE_OUTCOMES = ['ok', 'error', ...TRADE_KINDS, EXCHANGE, PACE];
/**
 * The steps that price (pricing.md): R1b, D1-finish (D1 in schema 2), the D1 gate's re-price pass and D2; amendment 11's
 * D1-build too, for its `find_upgrades` calls (D-444).
 */
const PRICING_STAGES = { 2: ['R1b', 'D1', 'D1-gate', 'D2'], 3: ['R1b', 'D1-build', 'D1-finish', 'D1-gate', 'D2'] };

/**
 * D-326, D-412: the run-log schema versions the checker reads: 4 (amendment 9), 3 (D-289), and 2 only so recorded runs
 * still check.
 */
const SCHEMA_VERSIONS = [2, 3, 4];
/**
 * The run log's fields: schema 2 (amendment 1 §4.1, D-270); schema 3 adds the parsed brief (D-289, C-51); schema 4
 * (D-412, D-415) drops `roll` and `outputs` for `builds[]` and the run-wide `dossier`, and adds `noNinja`, the pin's
 * commit, the digest and `resumes[]`.
 */
const RUN_LOG_FIELDS = {
  2: ['schemaVersion', 'runFolder', 'slug', 'roll', 'status', 'mode', 'testConfig', 'stages', 'checkpoints', 'escalations', 'faults', 'outputs'],
  3: ['schemaVersion', 'runFolder', 'slug', 'brief', 'roll', 'status', 'mode', 'testConfig', 'stages', 'checkpoints', 'escalations', 'faults', 'outputs'],
  4: ['schemaVersion', 'runFolder', 'slug', 'brief', 'status', 'mode', 'testConfig', 'noNinja', 'pinCommit', 'digest', 'dossier', 'builds', 'stages', 'checkpoints', 'displays', 'escalations', 'faults', 'resumes'],
};
/** D-412: a build's status, its fields in builds[], and its end statuses. */
const BUILD_STATUSES = ['queued', 'designing', 'writing', 'completed', 'file-only', 'not-accepted', 'dropped', 'stopped', 'escalated'];
const BUILD_FIELDS = ['id', 'roll', 'status', 'folder', 'guide', 'pobFile'];
/** D-435: a build whose finalize gave it a name carries `name` after `roll`, the title render-audit.mjs gives its audit. */
const BUILD_FIELDS_NAMED = ['id', 'roll', 'name', 'status', 'folder', 'guide', 'pobFile'];
const IN_PROGRESS = ['queued', 'designing', 'writing'];
/** D-415: a resume's entry, and the four lists whose lengths it records. */
const RESUME_FIELDS = ['date', 'pinCommit', 'digest', 'noNinja', 'lengths'];
const RESUME_LISTS = ['stages', 'checkpoints', 'escalations', 'displays'];
/** C-51, D-285, D-335: the brief's fields, every one optional. */
const BRIEF_FIELDS = ['ascendancy', 'skill', 'playstyle', 'budget', 'around', 'like', 'notes', 'popularity'];
/** C-51: the playstyle vocabulary (delivery, buttons, focus, defence, pace), which cards use too. */
const PLAYSTYLE_TAGS = ['melee', 'ranged-attack', 'spell', 'minion', 'totem-trap', 'mixed', 'one-button', 'few-buttons', 'combo', 'clear', 'boss', 'balanced', 'tanky', 'glass', 'fast', 'steady'];
/**
 * Schema 3's gates and questions (D-287, D-289), the design gate among them (D-362); schema 2 named the pick and
 * the guide checkpoints 1 and 2.
 */
const CHECKPOINTS = { 2: [1, 2, 'unsaved-build', 'escalation'], 3: ['brainstorm', 'verification', 'design', 'final', 'unsaved-build', 'escalation'] };
CHECKPOINTS[4] = CHECKPOINTS[3];
/** Schema 3's gate visits that print a display first; run-log.mjs records each in `displays[]` (D-367). */
const DISPLAYED = ['brainstorm', 'verification', 'design', 'final', 'escalation'];
const STATUSES = ['running', 'completed', 'not-accepted', 'stopped', 'escalated'];
/** An escalation's choices (D-236): schema 3 goes back to the verification gate, schema 2 to checkpoint 1 (D-289). */
const CHOICES = { 2: ['accept', 'retry', 'checkpoint-1', 'stop'], 3: ['accept', 'retry', 'verification', 'stop'], 4: ['accept', 'retry', 'verification', 'stop'] };
/**
 * A schema-2 concept id (`c1`), and a schema-3 card id `r<round>-<letter>-<n>` (`r1-a-2`, D-319): the letters a to c
 * a brainstorm round's researchers', g a card made at a gate (`r1-g-1`, D-391), s a composite (`r1-s-1`, D-429,
 * `COMPOSITE_CARD`), x the rival's (`r1-x-1`, D-408, `RIVAL_CARD`).
 */
const CONCEPT_ID = 'c[1-9]\\d*';
const CARD_ID = 'r[1-9]\\d*-[a-cgsx]-[1-9]\\d*';
/** A card made at a gate (D-391): `r<k>-g-<n>`, k its brainstorm round, n counting the run's gate-made cards in it. */
const GATE_CARD = /^r([1-9]\d*)-g-([1-9]\d*)$/;
/** The id form a run's steps, folders and files use: the card id in schema 3, the concept id in schema 2. */
const idSource = (schema) => (schema === 2 ? CONCEPT_ID : schema === 3 || schema === 4 ? CARD_ID : `(?:${CONCEPT_ID}|${CARD_ID})`);
const idForm = (schema) => (schema === 2 ? 'the concept id c<n>' : 'the card id r<round>-<letter>-<n>');
/** D-292: a card's probe variants, beyond R1b's two compiles. */
const PROBE_CAP = 4;
/**
 * D-433: a composite's probe variants (any card with `### Pieces`, whatever its id letter): the checklist's 4, then 4
 * leave-one-out probes.
 */
const COMPOSITE_PROBE_CAP = 8;
/** D-433: a composite's leave-one-out probes, so its Pieces measured holds at most 4 rows. */
const LEAVE_ONE_OUT = 4;
/** D-429: a round composes 1 to 4 composites; it is short with fewer than 2, or with none taking an under-played piece. */
const COMPOSE = { max: 4, min: 2 };
/** The gates whose visits print a display, and take questions (D-389): an interview note's and a gate question's names. */
const INTERVIEW_GATES = '(brainstorm|verification|design|final|escalation)';
/** D-390: a gate question step's compiled variant `probes/q-<gate>-<visit>-<n>/`. */
const QUESTION_PROBE = new RegExp(`^q-${INTERVIEW_GATES}-([1-9]\\d*)-([1-9]\\d*)$`);
/** D-420: the H2 of a visit's notes that holds the restated decision before the user's yes; no question. */
const PENDING_DECISION = 'Pending decision';
/** D-389, D-390: `interviews/<gate>-<visit>.md`, the visit's notes, and `interviews/<gate>-<visit>-q<n>.md`, a gate question step's report. */
const INTERVIEW_FILE = new RegExp(`^${INTERVIEW_GATES}-([1-9]\\d*)(?:-q([1-9]\\d*))?\\.md$`);
/** D-287, D-339: a brainstorm round deals 6–9 cards, and the deck keeps at least two under-played ones. */
const DEAL = { min: 6, max: 9, underPlayed: 2 };
const UNDER_PLAYED = /under-played \(judgment\b/i;
const OWNERS = ['W1', 'D1', 'D2'];
/** stages/V4.md: V4 checks the plan's claims and the guide (D-352); audit.md is rendered, the checker's to hold. */
const ARTIFACTS = ['plan.json', 'guide.md'];
/** D-351: why a claim is written (plan schema 3). */
const CLAIM_KINDS = ['hinge', 'reason'];
const PARTS = ['pass', 'fail', 'unverified'];
const GATE_STAGES = ['R1b', 'D1-gate', 'D2-gate'];
/** D-413: F1, the endgame-only build's final compile, writes a verdict in the D2 gate's shape. */
const GATE_PARTS = { R1b: ['compiled'], 'D1-gate': ['compiled', 'v1', 'v2', 'floor', 'budget', 'rolledSkill'], 'D2-gate': ['compiled', 'v1', 'v2'], F1: ['compiled', 'v1', 'v2'] };
/** D-419: schema 4's D1 gate adds the part `tree`, PoB's node power on each rung (a legacy D1 gate, before it, has none). */
const D1_PARTS4 = [...GATE_PARTS['D1-gate'], 'tree'];
/** D-419: a rung fails the tree part when its best swap left gains at least this much, in percent: Full DPS, or under amendment 11's rules the named source's damage (D-437). */
const TREE_FAIL_PERCENT = 5;
/** D-419, D-421: the tree part's codes: a swap left (`tree-swap`), `get_node_power` failing (`tool-error`), a refused call. */
const TREE_CODES = { fail: ['tree-swap'], unverified: ['tool-error', 'tool-refused'] };
/** D-413: F1's ledger refusal (D-211: the PoB file exists, or changed on disk), which escalates at once. */
const LEDGER_REFUSED = 'ledger-refused';
/** D-421: the code of a gate part a refused tool call left unverified; the gate re-runs alone, routed to no producer. */
const TOOL_REFUSED = 'tool-refused';
/** D-419: the code of the tree part `get_node_power` failed or timed out on; the gate re-runs alone, once, uncounted. */
const TOOL_ERROR = 'tool-error';
/**
 * D-264: a fix-round (or revision) owner, D1 or D2, that edited claims in place and compiled nothing. No gate
 * follows it, the final record stays the last D2 gate's, and the re-check stays targeted.
 */
const CLAIMS_EDITED = 'claims-edited';
/**
 * Each `stages[]` stage and the outcomes its entries may have (run-log.md); every step may miss its file. D1 is
 * two steps, D1-build and D1-finish (D-356), and V4 one pass, `V4`, or a re-check, `V4-recheck` (D-352), each
 * entry one report `reports/V4-<n>.md`. A schema-2 log keeps its one D1 step (D-326, D-341); its V4 entries are
 * the current ones, since each is one report, an artifact held to the current format.
 */
const COMMON_OUTCOMES = {
  R1a: ['done'],
  'R1a-assemble': ['done'],
  R1b: ['pass', 'fail'],
  'R1b-assemble': ['done'],
  'D1-gate': ['pass', 'fail', 'infeasible', 'escalated'],
  D2: ['done', CLAIMS_EDITED],
  'D2-gate': ['pass', 'fail', 'escalated'],
  W1: ['done'],
  V4: ['pass', 'fail'],
  'V4-recheck': ['pass', 'fail'],
};
const STAGE_OUTCOMES = {
  2: { ...COMMON_OUTCOMES, D1: ['done', 'infeasible', CLAIMS_EDITED] },
  // D-390: a gate question step, `Q`, answers the user's question at a gate and writes interviews/<gate>-<visit>-q<n>.md.
  // D-408: the rival, `RV`, writes its card (`done`) or finds no faster structure (`none-found`, with what it `tried`).
  3: { ...COMMON_OUTCOMES, 'D1-build': ['done', 'infeasible'], 'D1-finish': ['done', CLAIMS_EDITED], Q: ['done'], RV: ['done', 'none-found'] },
};
// Amendment 9 (schema 4): D1-tree (D-418), F1 (D-413) and V4's campaign pass (D-415). Amendment 11: D1-tree's `respec`
// (D-438) and D1-finish's `build` (§14), each routing D1-build next in the same attempt.
STAGE_OUTCOMES[4] = { ...STAGE_OUTCOMES[3], 'D1-tree': ['done', 'respec'], 'D1-finish': ['done', CLAIMS_EDITED, 'build'], F1: ['pass', 'fail', 'escalated'], 'V4-campaign': ['pass', 'fail'] };
// Amendment 10 (D-429): the brainstorm round's synthesis, which composes its builds in place of R1a-assemble's deal.
STAGE_OUTCOMES[4]['R1a-synthesize'] = ['done'];
// Amendment 13: D1-tree's `stale-server` (D-467), D1-tree again once the user reconnected the server; the file-only
// build's claims pass `V4-claims` (D-477).
STAGE_OUTCOMES[4]['D1-tree'] = ['done', 'respec', 'stale-server'];
STAGE_OUTCOMES[4]['V4-claims'] = ['pass', 'fail'];
/** D-421: a step the permission system refused, logged so and re-run alone, uncounted (schema 4). */
const REFUSED = 'refused';
/** D-467 (amendment 13): D1-tree's stop on a session server built before M-26, whose node power ignores the targets. */
const STALE_SERVER = 'stale-server';
const OUTCOMES = ['pass', 'fail', 'done', 'infeasible', 'escalated', 'missing', CLAIMS_EDITED, 'none-found', REFUSED, 'respec', 'build', STALE_SERVER];
/** The D1 steps: schema 3's two (D-356), schema 2's one, and schema 4's tree step (D-418). */
const D1_STAGES = ['D1', 'D1-build', 'D1-tree', 'D1-finish'];
/**
 * The steps that write each artifact a V4 report locates its findings in (stages/V4.md). audit.md is written by
 * the render script and W1's Known-issues rows (D-355), and the runner's step-14 edits add only `Known issues`
 * lines, which hold no claim; V4 doesn't check it.
 */
const ARTIFACT_WRITERS = { 'plan.json': [...D1_STAGES, 'D1-gate', 'D2'], 'guide.md': ['W1'], 'audit.md': ['render-audit.mjs', 'W1'] };
/** The steps that write plan.json or compile it: after one of them, an earlier guide is out of date. */
const DESIGN_STAGES = [...D1_STAGES, 'D1-gate', 'D2', 'D2-gate', 'F1'];
/** The producers whose run, unless it only edited claims (`claims-edited`), leaves the final record behind. */
const PRODUCERS = [...D1_STAGES, 'D2'];
/** D-413: the steps that run a build's final compile: the D2 gate's (a full build), or F1 (an endgame-only build). */
const FINAL_GATES = ['D2-gate', 'F1'];
/** A step's entry that produced nothing to read: a missing return, or a refused call (D-421). */
const idle = (s) => s.outcome === 'missing' || s.outcome === REFUSED;
/** The steps that concern no one concept or card: the rounds' steps, a gate question step (D-390) and the rival (D-408). */
const ROUND_STAGES = ['R1a', 'R1a-assemble', 'R1a-synthesize', 'R1b-assemble', 'Q', 'RV'];
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
/**
 * D-254: every endgame stage holds a waystone-scaled reference hit of each type, which the compiler writes into
 * its config from the data when the plan omits it (D-353). D-256: PoB takes these options as whole numbers, so a
 * hit is its formula's value rounded to 2 decimals (which absorbs float32 noise in the inputs), then rounded up.
 */
const HIT_TYPES = ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'];
/** Findings that report on a passing part (../references/gates.md): never failures. D-440: a boots exception, V1's. */
const INFO_CODES = ['chaos-exception', 'over-target', 'boots-exception'];

/**
 * D-370, D-371: the targets. `m` aims at 5 divines in all (M_TARGET) and each rare of `b` and `n` at its entry's
 * `query.target.divines`, each at its rung's price day (PRICE_DAY: 7, 7 and 21). A target is never a pass mark:
 * the budget part is `pass` or `unverified`, and a rare or `m`'s total over its target is an `over-target`
 * finding, information only. The gate adds by hand, so the checker holds its numbers to its own recompute within
 * one rounding step (0.1 under 10 divines, 1 at 10 or more), and an over-target finding may differ from it only
 * where the midpoint is within 0.1 divine of the target (1 for a target of 10 or more): gates.md.
 */
const BUDGET_PARTS = ['pass', 'unverified'];
const roundingStep = (x) => (x < 10 ? 0.1 : 1);
const targetMargin = (target) => (target >= 10 ? 1 : 0.1);

// ---------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v, min = 0) => Number.isInteger(v) && v >= min;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const show = (v) => JSON.stringify(v);
const round2 = (x) => Math.round(x * 100) / 100;
/** M-25's leftover (amendment 13 §15): a percentage in a failure message, whole as it is, else to one decimal: 60.0, never 59.980000000000004. */
const pct1 = (x) => (isNum(x) ? (Number.isInteger(x) ? String(x) : x.toFixed(1)) : show(x));
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

// ---------------------------------------------------------------------------------------------------
// Amendment 13's names and rules (D-465, D-466, D-471, D-472)
// ---------------------------------------------------------------------------------------------------

/** A text compared as the rules read names: lower case, any dash a hyphen, any apostrophe straight, spaces collapsed. */
const plainName = (s) => String(s ?? '').replace(/[`*_]/g, '').replace(/[‐-―−]/g, '-').replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
/**
 * D-465 (amendment 13): a rune over the budget: a "Legacy of …" soul core (the name starting "Legacy of ", never one merely
 * holding "Legacy", such as Coward's Legacy), or the Raven-Touched Shard. Returns `legacy`, `shard` or null.
 */
export function overBudgetRune(name) {
  const n = plainName(name);
  if (/^legacy of \S/.test(n)) return 'legacy';
  if (/\braven-touched shard\b/.test(n)) return 'shard';
  return null;
}
/**
 * D-465: whether the user asked for a rune over the budget: one of `says` (the brief's `around`, `like` and `notes`, and
 * every gate answer's words: its answer, changes and note) names it, a parenthesis after the rune's name aside, or, for
 * a "Legacy of …" core, names the Legacy cores generally ("Legacy cores", "Legacy soul cores").
 */
export function askedFor(name, says) {
  const kind = overBudgetRune(name);
  const want = plainName(String(name).replace(/\s*\([^)]*\)\s*$/, ''));
  return says.some((t) => {
    const x = plainName(t);
    return x.includes(want) || (kind === 'legacy' && /\blegacy (?:soul )?cores?\b/.test(x));
  });
}
/** D-465: the user's words a run holds: the brief's `around`, `like` and `notes`, and each gate answer, its changes and note. */
function userWords(log) {
  const b = isObj(log.brief) ? log.brief : {};
  const words = [b.around, b.like, b.notes];
  for (const c of list(log.checkpoints)) words.push(c.answer, ...(isObj(c.changes) ? Object.values(c.changes) : []), c.note);
  return words.filter((t) => typeof t === 'string' && t.trim() !== '');
}

/**
 * D-466 (amendment 13): a build's name as the server cleans it for a file name: each character Windows refuses (`< > : "
 * / \ | ? *`) a space, runs of spaces one, trailing dots and spaces gone; a name that is a Windows device name whole
 * (CON, PRN, AUX, NUL, COM1–COM9, LPT1–LPT9) gains " (build)".
 */
export function cleanName(name) {
  const s = String(name ?? '').replace(/[<>:"/\\|?*]/g, ' ').replace(/ {2,}/g, ' ').replace(/[. ]+$/, '');
  return /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(s) ? `${s} (build)` : s;
}
/**
 * D-466 (§7): the file names a build held to revision 13 may write, compared without case (D-52): its final file
 * `<name>`, `<name> <run date>` and `<name> <run date> <k>` (k from 2), a campaign's each ending ` (campaign)`, and its
 * draft `<name> (draft)` or `<name> (draft <k>)`, `<name>` the cleaned session name. `kind` is `final`, `campaign` or
 * `draft`; `base` the file's name without `.xml`.
 */
export function nameFits(base, name, date, kind) {
  const n = cleanName(name).toLowerCase();
  const b = String(base).toLowerCase();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (kind === 'draft') return new RegExp(`^${esc(n)} \\(draft(?: (?:[2-9]|[1-9]\\d+))?\\)$`).test(b);
  const dated = date ? `(?: ${esc(date)}(?: (?:[2-9]|[1-9]\\d+))?)?` : '';
  return new RegExp(`^${esc(n)}${dated}${kind === 'campaign' ? ' \\(campaign\\)' : ''}$`).test(b);
}

/**
 * D-466: a build's session name: its `builds[].name` when a revision renamed it (D-435), else its card's name (the card
 * file's Pitch `Name`, or its deck line's); null when the run holds neither.
 */
function sessionName(runFolder, build) {
  if (typeof build.name === 'string' && build.name.trim() !== '') return build.name.trim();
  const read = (rel) => {
    try {
      return fs.readFileSync(path.join(runFolder, ...rel.split('/')), 'utf8');
    } catch {
      return null;
    }
  };
  const card = parseCard(read(`cards/${build.id}.md`)).name;
  if (typeof card === 'string' && card.trim() !== '') return card.trim();
  const line = parseDeck(read('cards.md')).entries.find((d) => d.id === build.id)?.name;
  return typeof line === 'string' && line.trim() !== '' ? line.trim() : null;
}

/**
 * PoB's item text, read as the rules need it (D-471, D-472): `rarity` (upper case), `name` (the line after the rarity),
 * its lines trimmed, `corrupted` (a `Corrupted` or `Twice Corrupted` line), and `enchants`, its `{enchant}` lines but the
 * amulet anoint's `Allocates <notable>`: a designed corruption's outcome (`Classes/ItemsTab.lua`:2767).
 */
export function itemOf(textOrNull) {
  const lines = String(textOrNull ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const r = /^Rarity:\s*(\S+)/i.exec(lines[0] ?? '');
  const rarity = r ? r[1].toUpperCase() : null;
  const enchants = lines.filter((l) => /^\{enchant\}/i.test(l)).map((l) => l.replace(/^\{enchant\}/i, '').trim()).filter((l) => !/^Allocates\s/i.test(l));
  return { rarity, name: r ? lines[1] ?? null : null, lines, corrupted: lines.some((l) => l === 'Corrupted' || l === 'Twice Corrupted'), enchants };
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
 * D-378: the groups a stage's record resolved a minion skill for (`minionSkills`). Such a group's figure is its
 * minion's, `MinionTotalDPS` in place of `TotalDPS` (0 for a summon), at the same key: `src/plan/record.ts`'s
 * `figureField`.
 */
const minionGroups = (stageRecord) => new Set(list(stageRecord?.minionSkills).map((m) => m.group));

/**
 * D-385: whether the skill at a record key summons a minion: PoB measures the summon's minion, so the key's
 * `skillOutputs` entry carries `Minion<Field>` fields (a plain summon such as Skeletal Warrior, which names no
 * minion skill). Such a group's figure is its minion's too.
 */
const summonsMinion = (stageRecord, key) =>
  Object.keys(stageRecord?.skillOutputs?.[key]?.fields ?? {}).some((field) => /^Minion[A-Z]/.test(field));

/**
 * D-340: a compared figure `g<group>s<skill>p<statSet>.<Field>` of a stage's record, read × its group's Count
 * from `countedSkillOutputs` where the record has a counted copy of the field, else raw from `skillOutputs`
 * (the per-copy value; a record from before WU-55 has no counted copies). A minion's figure is an ordinary field,
 * `MinionTotalDPS`, with its counted copy (D-376, D-378).
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

/**
 * D-474 (amendment 13): a line with its inline code spans blanked: a run of backticks opens a span that the next run of
 * as many backticks closes (CommonMark), so `` `[^|]` `` holds no marker; an unclosed run stays as text.
 */
export function withoutCodeSpans(line) {
  return String(line).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m) => ' '.repeat(m.length));
}

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
    // D-474 (amendment 13): a marker inside an inline code span (`[^|]`, a pattern) is the span's text, not a marker.
    for (const m of withoutCodeSpans(line).matchAll(/\[\^([^\]\s]+)\]/g)) markers.push({ id: m[1], line: i });
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

/**
 * A definition line's body (§7.3): `<kind> | <ref> [| accessed: …] [| patch: …] [| confidence: …]`, or a citation. D-474
 * (amendment 13): one definition may hold several data citations joined by `; `, `data | <file>#<key>; data | …`, read
 * as `{kind: "data", refs: [{file, key}, …]}` (its first ref's `file` and `key` beside them).
 */
export function parseDefinition(body) {
  const segments = body.split(/;\s+/);
  if (segments.length > 1 && segments.every((s) => /^\s*data\s*\|/.test(s))) {
    const refs = segments.map((s) => /^\s*data\s*\|\s*([^#\s|]+)#(\S+)\s*$/.exec(s));
    if (refs.some((m) => m === null)) return { error: 'a data definition is "data | <file>#<key>", several joined by "; "' };
    return { kind: 'data', file: refs[0][1], key: refs[0][2], refs: refs.map((m) => ({ file: m[1], key: m[2] })) };
  }
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
/** Why a `data | <file>#<key>` citation names nothing under data/, or null: a Markdown file's entry, or a JSON fact. */
function resolveFact(file, key) {
  if (/\.md$/i.test(file)) return resolveEntry(file, key);
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

/** The Markdown data files read so far (the league digests, the rule-changer index, the monster table), by path. */
const markdownFiles = new Map();
/** An entry id (M-20's handoff): lower-case words or numbers joined by `-`, unique in its file. */
const ENTRY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The rule-changer index's node lines (D-401): `- <Name> (<node id>, <ascendancy or keystone>) …`, cited by the node id. */
const NODE_LINES = 'rules/nodes.md';
/**
 * D-400, D-401, D-402: a citation `data | <path under data/>#<id>` to a Markdown data file names one entry: an H3
 * `### <Name>` whose next line is `- Id: <id>`, the id unique in its file. In `rules/nodes.md`, whose entries are
 * lines, an all-digit id names the line whose parenthesis starts with that node id, `- <Name> (<id>, …`. Returns why
 * the citation names none, or null.
 */
function resolveEntry(file, id) {
  if (!markdownFiles.has(file)) {
    let text = null;
    try {
      const abs = path.resolve(DATA_DIR, file);
      if (abs.startsWith(DATA_DIR + path.sep)) text = fs.readFileSync(abs, 'utf8');
    } catch {
      text = null;
    }
    markdownFiles.set(file, text);
  }
  const text = markdownFiles.get(file);
  if (typeof text !== 'string') return `no data file "${file}" under data/`;
  if (!ENTRY_ID.test(id)) return `"${id}" isn't an entry id, lower-case words or numbers joined by "-"`;
  const lines = text.split(/\r?\n/);
  if (file === NODE_LINES && /^\d+$/.test(id)) {
    const n = lines.filter((l) => new RegExp(`^[-*]\\s+[^(]*\\(${id}[,)]`).test(l)).length;
    if (n === 1) return null;
    return n === 0 ? `${file} has no node line "- <Name> (${id}, …)"` : `${file} has ${n} node lines for node ${id}; a node has one`;
  }
  const n = lines.filter((l, i) => /^###\s+\S/.test(l) && new RegExp(`^[-*]\\s+Id:\\s*${id}\\s*$`).test(lines[i + 1] ?? '')).length;
  if (n === 1) return null;
  return n === 0 ? `${file} has no entry "${id}": an H3 "### <Name>" whose next line is "- Id: ${id}"` : `${file} holds the entry id "${id}" ${n} times; an id is unique in its file`;
}

/** The mechanic families of data/rules/vocabulary.md (D-401, D-405), `none` among them; null when it can't be read. */
let vocabulary;
function vocabularyWords() {
  if (vocabulary === undefined) {
    vocabulary = null;
    try {
      const words = new Set(['none']);
      // Each list item `- \`<family>\`[, \`<family>\` …]: <what it covers>`, its wrapped lines joined to it.
      const items = fs.readFileSync(path.join(DATA_DIR, 'rules', 'vocabulary.md'), 'utf8').split(/\r?\n/).reduce((out, line) => {
        if (/^\s+\S/.test(line) && out.length > 0) out[out.length - 1] += ` ${line.trim()}`;
        else out.push(line);
        return out;
      }, []);
      for (const line of items) {
        const m = /^[-*]\s+((?:`[a-z0-9-]+`(?:,\s*)?)+):/.exec(line);
        if (m) for (const w of m[1].matchAll(/`([a-z0-9-]+)`/g)) words.add(w[1]);
      }
      if (words.size > 1) vocabulary = words;
    } catch {
      vocabulary = null;
    }
  }
  return vocabulary;
}

/** The server's ledger evaluator, or null when the server isn't built. */
/** The server's build projection (`buildSha1`), or null when the server isn't built. */
async function loadBuildHashModule() {
  if (!fs.existsSync(buildHashModulePath())) return null;
  const mod = await import(pathToFileURL(buildHashModulePath()).href);
  return typeof mod.buildSha1 === 'function' ? mod : null;
}

async function loadLedgerModule() {
  if (!fs.existsSync(ledgerModulePath())) return null;
  const mod = await import(pathToFileURL(ledgerModulePath()).href);
  return typeof mod.evaluateLedger === 'function' ? mod : null;
}

/**
 * D-435: the checker against a stale build. When the server's `build/plan/ledger.js` or `build/plan/buildHash.js` is
 * older than its source under `src/plan/`, a `record-plan` or ledger violation may come from the stale build, not the
 * run: one warning per stale module. The violations stay.
 */
function staleBuildWarnings() {
  const build = serverBuild();
  const src = path.join(path.dirname(build), 'src', 'plan');
  const mtime = (f) => {
    try {
      return fs.statSync(f).mtimeMs;
    } catch {
      return null;
    }
  };
  const out = [];
  for (const name of ['ledger', 'buildHash']) {
    const js = path.join(build, 'plan', `${name}.js`);
    const ts = path.join(src, `${name}.ts`);
    const [built, source] = [mtime(js), mtime(ts)];
    if (built !== null && source !== null && built < source) {
      out.push(`the server's build/plan/${name}.js is older than its source src/plan/${name}.ts, so a record-plan or ledger violation may come from the stale build, not the run: rebuild the server (pnpm build) and check again (D-435)`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The checker
// ---------------------------------------------------------------------------------------------------

/** Reads inside a folder: paths relative to `base`, each read failure a violation under `rule` (`layout` by default). */
function folderIO(base, fail) {
  const abs = (rel) => path.join(base, ...rel.split('/'));
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
  return { abs, exists, isDir, listDir, readText, readJson };
}

/**
 * The source-tag and marker checks (§7.3, C-30; AC-W2 d, e, f, g), bound to a `fail` and the run's mode: a plan's
 * claims, a markdown artifact's definitions and markers.
 */
function sourceChecks(fail, offline, mode) {
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
      // D-474: a definition holding several data citations checks each of them.
      for (const ref of Array.isArray(cite.refs) ? cite.refs : [cite]) {
        const why = resolveFact(ref.file, ref.key);
        // D-400: a Markdown data file's entry (the league digest, the rule-changer index, the monster table) by its id.
        const what = /\.md$/i.test(ref.file) ? "no entry of a Markdown data file (D-400, M-20's entry id)" : 'no C1/E1 fact (D-232)';
        if (why !== null) fail('markers', `${where}: data ${ref.file}#${ref.key} names ${what}: ${why}`);
      }
    }
  };
  const planScope = (p) => ({
    ledger: new Set(isObj(p) && Array.isArray(p.ledger) ? p.ledger.map((e) => e?.id) : []),
    prices: new Set(isObj(p) && Array.isArray(p.prices) ? p.prices.map((e) => e?.id) : []),
  });

  /** Claims of a plan: one per stages[].claims[] entry, with its source's kind and location. */
  const planClaims = (p, label) => {
    const out = [];
    if (!isObj(p) || !Array.isArray(p.stages)) return out;
    const scope = planScope(p);
    p.stages.filter(isObj).forEach((s, i) => {
      (Array.isArray(s.claims) ? s.claims : []).forEach((c, k) => {
        const where = `${label} stages[${i}].claims[${k}]`;
        if (!isObj(c)) return;
        // D-351: a claim is written only where the build hinges, and says which: `hinge` or `reason` (plan schema 3).
        if (!CLAIM_KINDS.includes(c.kind)) {
          fail('claim-kind', `${where} (${show(c.id)}) has kind ${show(c.kind)}; every claim is "hinge" (a fact whose being wrong would make the build fail at its rung) or "reason" (resting on a measurement), plan schema 3 (D-351)`);
        }
        if (typeof c.source === 'string') {
          const m = /^(?:(ledger|price):(\S+)|data:([^#\s]+)#(\S+))$/.exec(c.source);
          if (!m) return fail('source-tags', `${where}: source ${show(c.source)} is neither a tag nor ledger:, price: or data:`);
          const cite = m[1] ? { kind: m[1], id: m[2] } : { kind: 'data', file: m[3], key: m[4] };
          // D-400: a Markdown data entry is cited only in a research file's footnotes; compile_plan's validation resolves
          // a plan's data: sources in the campaign and enemies JSON facts alone (D-232), so it would refuse the plan.
          if (cite.kind === 'data' && /\.md$/i.test(cite.file)) {
            fail('markers', `${where}: source ${show(c.source)} cites a Markdown data entry; those are cited only in research footnotes, never in a plan: compile_plan resolves a plan's data: sources in the campaign and enemies JSON facts alone (D-232, D-400)`);
          } else checkCitation(where, cite, scope);
          out.push({ kind: cite.kind, at: `stages[${i}].claims[${k}]`, id: c.id });
        } else {
          checkTag(where, c.source);
          out.push({ kind: c.source?.kind, at: `stages[${i}].claims[${k}]`, id: c.id });
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
  return { checkTag, checkCitation, planScope, planClaims, markdownClaims };
}

/**
 * D-415: the part of a migrated run's log that schema 3's pipeline recorded: the entries before its first resume (all of
 * them before any resume), by the lengths that resume recorded. Null for a log recorded in schema 4 from its start, a
 * migrated run's mark being its build in "." (D-412).
 */
function legacyPart(log) {
  if (log.schemaVersion !== 4 || !list(log.builds).some((b) => b.folder === '.')) return null;
  const first = list(log.resumes).find((r) => isObj(r.lengths));
  const len = (k) => (Array.isArray(log[k]) ? log[k].length : 0);
  return Object.fromEntries(RESUME_LISTS.map((k) => [k, isInt(first?.lengths?.[k]) ? first.lengths[k] : len(k)]));
}

/** D-433: the run's composites: each card file `cards/<id>.md` with a `### Pieces` table, whatever its id letter. */
function compositeIds(runFolder) {
  const out = new Set();
  let files;
  try {
    files = fs.readdirSync(path.join(runFolder, 'cards'));
  } catch {
    return out;
  }
  for (const f of files) {
    const m = new RegExp(`^(${CARD_ID})\\.md$`).exec(f);
    if (!m) continue;
    try {
      if (parseCard(fs.readFileSync(path.join(runFolder, 'cards', f), 'utf8')).pieces !== null) out.add(m[1]);
    } catch {
      // a folder, or unreadable: the layout check names it
    }
  }
  return out;
}

export async function checkRun(runFolder) {
  const violations = [];
  const fail = (rule, message) => violations.push({ rule, message });
  // D-435: the result's warnings, a stale server build among them; `display final` prints them. The violations stay.
  violations.warnings = staleBuildWarnings();
  const { abs, exists, isDir, listDir, readText, readJson } = folderIO(runFolder, fail);

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
  // D-326: a schema-2 log is a run recorded before amendment 3, checked by its own rules; schema 4 is amendment 9's
  // (D-412); any other version is checked as schema 3 (a log of none of them fails checkRunLog).
  const schema = SCHEMA_VERSIONS.includes(log.schemaVersion) ? log.schemaVersion : null;
  const v3 = schema !== 2;
  const v4 = schema === 4;
  const ID = new RegExp(`^${idSource(schema)}$`);
  // D-433: a composite is any card with `### Pieces`, whatever its id letter; its probe cap is 8, a plain card's 4.
  const composites = compositeIds(runFolder);
  const probeCap = (id) => (composites.has(id) ? COMPOSITE_PROBE_CAP : PROBE_CAP);
  const capWords = (id) => (composites.has(id) ? `a composite has at most ${COMPOSITE_PROBE_CAP}: the checklist's 4, then 4 leave-one-outs (D-433)` : `a card has at most ${PROBE_CAP} (D-292)`);
  checkRunLog(log, fail, schema, { probeCap, capWords });
  // D-444: the pricing stops and the retries, for the entries held to amendment 11's rules.
  if (v4) checkPricing(log, fail);
  /** §19: the stages[] index from which the log is held to amendment 11's rules (Infinity for an older run's log). */
  const heldStage = heldFrom(log);
  const mode = log.mode;
  const offline = mode === 'offline';
  const stages = list(log.stages);
  const escalations = list(log.escalations);
  const runDir = typeof log.runFolder === 'string' ? log.runFolder.replace(/\\/g, '/').replace(/\/+$/, '') : '';
  const runName = runDir.split('/').slice(-2).join('-'); // <slug>-<YYYY-MM-DD>-<n>: the PoB file's build_name (§2)
  const runDate = (/(\d{4}-\d{2}-\d{2})-\d+$/.exec(runDir) ?? [])[1] ?? null;
  // D-412: the run's builds: schema 4's builds[] (a migrated run's build in "."), else the one build at the root.
  const builds = v4 ? list(log.builds).filter((b) => typeof b.id === 'string' && typeof b.folder === 'string') : [{ id: null, folder: '.', status: null }];
  const rootBuild = builds.find((b) => b.folder === '.') ?? null;
  /** D-415: a migrated run's entries recorded by schema 3's pipeline, before its first resume; null for any other run. */
  const legacy = legacyPart(log);

  // ---- Layout (§2; the cards, the deck and the probes since amendment 3, D-338) ----------------------
  // D-412: a schema-4 run holds its builds in builds/<id>/; only a migrated run's build stays at the root.
  const BUILD_TOP = ['plan.json', 'compile-record.json', 'compiled-build.xml', 'guide.md', 'audit.md', 'pieces.md', 'trades.json', 'rounds'];
  const KNOWN_TOP = ['run-log.json', 'research', 'cards', 'cards.md', 'interviews', 'concepts', 'probes', 'dossier.md', 'reports', ...(rootBuild ? BUILD_TOP : []), ...(v4 ? ['builds'] : [])];
  // run-log.mjs writes run-log.json.tmp, then renames it over the log; one left by a write cut short is no output.
  for (const name of fs.readdirSync(runFolder).filter((x) => x !== 'run-log.json.tmp')) {
    if (!KNOWN_TOP.includes(name)) fail('layout', `${name} isn't part of the run-folder layout (§2)${v4 && BUILD_TOP.includes(name) ? "; a schema-4 run keeps each build's files in its folder builds/<id>/ (D-412)" : ''}; agents write only the files §2 names`);
  }
  if (v4) {
    // D-412: builds/<id>/, one folder per build builds[] names, and nothing else.
    if (exists('builds') && !isDir('builds')) fail('layout', 'builds is a file; §2 names the folder builds/, one builds/<id>/ per build (D-412)');
    for (const f of listDir('builds')) {
      if (!isDir(`builds/${f}`) || !builds.some((b) => b.folder === `builds/${f}`)) fail('layout', `builds/${f} isn't the folder of a build run-log.json's builds[] names (D-412)`);
    }
  }
  for (const [name, dir] of [['cards', true], ['cards.md', false], ['probes', true], ['interviews', true]]) {
    if (exists(name) && isDir(name) !== dir) fail('layout', `${name} is a ${dir ? 'file' : 'folder'}; §2 names ${dir ? `the folder ${name}/` : `the file ${name}`}`);
    // D-326: the cards, the deck and the probes are schema 3's layout (D-319, D-338); a schema-2 run has none.
    if (!v3 && exists(name)) fail('layout', `${name}${dir ? '/' : ''} is part of schema 3's layout (${name === 'interviews' ? 'the interview notes, D-389' : 'the cards, the deck and the probes, D-338'}); a schema-2 run, recorded before amendment 3, has none (D-326)`);
  }
  // C-52, D-319: R1a writes each card at cards/<id>.md, and R1b its verification half; nothing else goes there.
  const cardIds = new Set();
  for (const f of listDir('cards')) {
    const m = new RegExp(`^(${CARD_ID})\\.md$`).exec(f);
    if (!m || isDir(`cards/${f}`)) fail('layout', `cards/${f} isn't a card file cards/<id>.md, the id r<round>-<letter>-<n> (§2, D-319; the letter g for a card made at a gate, D-391, and x for the rival's, D-408)`);
    else cardIds.add(m[1]);
  }
  // D-408: the rival's step, once per run after the first verification round's assembly (or at a gate, on request).
  const rivalRan = stages.some((s) => s.stage === 'RV' && s.outcome !== 'missing');
  // D-443 (amendment 11): the rival is removed; a run held to amendment 11's rules runs none, and an older run's RV
  // entries, x card and dossier row stay readable (§19).
  stages.forEach((s, i) => {
    if (i >= heldStage && s.stage === 'RV') fail('rival', `run-log.json stages[${i}] runs the rival (RV), which amendment 11 removes: a run held to its rules (skillRevision ${A11}) never runs it (D-443)`);
  });
  // D-452 (amendment 12, Appendix A): one tree per loadout, so the entries held to amendment 12 have no D1-tree `respec`;
  // an older run's respec route stays readable (§22).
  const held12 = heldFrom(log, 'stages', 12);
  stages.forEach((s, i) => {
    if (i >= held12 && s.stage === 'D1-tree' && s.outcome === 'respec') fail('respec', `run-log.json stages[${i}] (${s.stage} ${s.concept ?? ''} attempt ${s.attempt}) is a respec, which amendment 12 removes: in a run held to its rules (skillRevision 12) each loadout's tree is its own, D1-tree never returns respec, and a respec request is a tree request, D1-tree then D1-finish (D-452)`);
  });
  /** D-429: a run whose brainstorm rounds R1a-synthesize composed. */
  const composite = stages.some((s) => s.stage === 'R1a-synthesize');
  if (log.status === 'completed' && !exists('dossier.md')) fail('layout', 'dossier.md is missing; a completed run has its dossier (§2)');
  if (v4 && log.dossier !== null && log.dossier !== undefined && (typeof log.dossier !== 'string' || !exists(log.dossier))) fail('run-log', `dossier is ${show(log.dossier)}, which names no file in the run folder (D-412)`);
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

  // Plans: each build's own, the skeletons and the probes; prices and ledger ids resolve across the first two.
  const buildPlans = new Map(builds.map((b) => [b, readJson(inFolder(b.folder, 'plan.json'))]));
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
  // D-390: a gate question step's coordinator may compile one variant, probes/q-<gate>-<visit>-<n>/, its question
  // report interviews/<gate>-<visit>-q<n>.md; it counts toward no card's probes.
  const questionProbes = [];
  for (const id of listDir('probes')) {
    const q = QUESTION_PROBE.exec(id);
    if (q && isDir(`probes/${id}`)) {
      questionProbes.push({ dir: id, report: `interviews/${q[1]}-${q[2]}-q${q[3]}.md` });
      if (!exists(`probes/${id}/plan.json`)) fail('layout', `probes/${id}/plan.json is missing; a gate question step writes the variant it compiles there (D-390)`);
      const p = readJson(`probes/${id}/plan.json`);
      if (p !== null) probePlans.set(id, p);
      measureOnlyFolder(`probes/${id}`, "a gate question step's variants");
      continue;
    }
    if (!new RegExp(`^${CARD_ID}$`).test(id) || !isDir(`probes/${id}`)) {
      fail('layout', `probes/${id} isn't a card's probe folder probes/<card-id>/, the id r<round>-<letter>-<n> (§2, D-331), or a gate question step's variant probes/q-<gate>-<visit>-<n>/ (D-390)`);
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
    if (ns.length > probeCap(id)) fail('probes', `probes/${id}/ holds ${ns.length} probe variants; ${capWords(id)}`);
    probeCounts.set(id, ns.length);
  }
  const allPlans = [...[...buildPlans.values()].filter(isObj), ...[...conceptPlans.values()].filter(isObj)];
  const ledgerIds = new Set(allPlans.flatMap((p) => (Array.isArray(p.ledger) ? p.ledger.map((e) => e?.id) : [])));
  const priceIds = new Set(allPlans.flatMap((p) => (Array.isArray(p.prices) ? p.prices.map((e) => e?.id) : [])));

  // ---- Offline mode (§11.1, D-233; AC-W2 k) -----------------------------------------------------
  if (offline) {
    const labelled = [
      ...[...buildPlans].map(([b, p]) => [inFolder(b.folder, 'plan.json'), p]),
      ...[...conceptPlans].map(([id, cp]) => [`concepts/${id}/plan.json`, cp]),
      ...[...probePlans].map(([at, pp]) => [`probes/${at}/plan.json`, pp]),
    ];
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
  const sources = sourceChecks(fail, offline, mode);
  const runScope = { ledger: ledgerIds, prices: priceIds };
  for (const [id, cp] of conceptPlans) sources.planClaims(cp, `concepts/${id}/plan.json`);
  for (const [at, pp] of probePlans) sources.planClaims(pp, `probes/${at}/plan.json`);
  for (const f of researchFiles) {
    const text = readText(`research/${f}`);
    if (text !== null) sources.markdownClaims(parseMarkdown(text), `research/${f}`, runScope);
  }

  // ---- Reports: the gate verdicts (§2, gates.md), run-wide in reports/gates/ ---------------------------
  const gates = [];
  const GATE_FILE = new RegExp(`^(R1b|D1-gate|D2-gate${v4 ? '|F1' : ''})-(${idSource(schema)})-a([1-9]\\d*)\\.json$`);
  for (const f of listDir('reports/gates')) {
    const m = GATE_FILE.exec(f);
    if (!m) fail('layout', `reports/gates/${f} isn't named <stage>-<${v3 ? 'card' : 'concept'}>-a<attempt>.json, with ${idForm(schema)} (§2)`);
    else gates.push({ file: `reports/gates/${f}`, stage: m[1], concept: m[2], attempt: Number(m[3]) });
  }
  // D-415: a D1 gate verdict written before a migrated run's first resume is schema 3's, with no `tree` part.
  const loggedAt = new Map(stages.map((s, i) => [`reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`, i]));
  const legacyGate = (file) => !v4 || (legacy !== null && (loggedAt.get(file) ?? -1) < legacy.stages);
  // §19, D-437: a verdict logged after the skill-revision stamp (or not logged, in a log that has one) is held to
  // amendment 11's rules: its tree swap ranks by the named source's damage, and its messages say so.
  const heldGate = (file) => heldStage !== Infinity && (loggedAt.get(file) ?? Infinity) >= heldStage;
  const gatePlan = (g) => buildPlans.get(v4 ? builds.find((b) => b.id === g.concept) : builds[0]) ?? null;
  const gateReports = new Map();
  for (const g of gates) {
    const rep = readJson(g.file, 'gate-report');
    if (rep === null) continue;
    checkGateReport(rep, g, fail, { v4, legacy: legacyGate(g.file), held: heldGate(g.file), plan: gatePlan(g) });
    if (isObj(rep)) gateReports.set(g.file, rep);
  }

  // ---- Dossier (§7.2, as D-355 reduces it): the verification gate's comparison table -------------------
  const dossierText = readText('dossier.md');
  if (dossierText !== null) {
    const lastAssembly = stages.reduce((at, s, i) => (s.stage === 'R1b-assemble' && s.outcome === 'done' ? i : at), -1);
    const assembled = [...new Set(stages.slice(0, lastAssembly + 1).filter((s) => s.stage === 'R1b').map((s) => s.concept))];
    // D-400, D-408: the terminal code of each card's last R1b attempt, which its row's status says.
    const terminal = new Map();
    for (const s of stages.slice(0, lastAssembly + 1)) {
      if (s.stage === 'R1b' && s.outcome !== 'missing') terminal.set(s.concept, s.outcome === 'fail' ? terminalR1b(gateReports.get(`reports/gates/R1b-${s.concept}-a${s.attempt}.json`)) : null);
    }
    // §19: a dossier written after the run's skill-revision stamp is amendment 11's, with no number column (D-436); one
    // written before it is read by its own header.
    const cardOf = (id) => parseCard(readText(`cards/${id}.md`));
    // D-436, D-437: a skeleton whose named source a meta gem triggers (its record's `measures.trigger`).
    const triggered = (id) => Object.values(isObj(readJson(`concepts/${id}/compile-record.json`)?.stages) ? readJson(`concepts/${id}/compile-record.json`).stages : {}).some((x) => isObj(x?.measures?.trigger));
    checkDossier(dossierText, assembled, ID, fail, { rivalRan, terminal, composite, a11: lastAssembly >= 0 && lastAssembly >= heldStage, cardOf, composites, triggered });
  }

  // ---- Escalations name their verdict files; accepted gate findings (§5.4, D-236) ------------------
  // D-411: in schema 4 an accepted finding is its build's: it covers only gate findings of the same card.
  const accepted = [];
  for (const [i, e] of escalations.entries()) {
    const want = `reports/gates/${e.stage}-${e.concept}-a`;
    const rep = typeof e.verdict === 'string' ? gateReports.get(e.verdict) : undefined;
    if (typeof e.verdict !== 'string' || !e.verdict.startsWith(want) || !rep) {
      fail('escalation', `escalations[${i}].verdict is ${show(e.verdict)}; it names the escalated attempt's verdict file, ${want}<n>.json (§4.1)`);
      continue;
    }
    if (e.choice !== 'accept') continue;
    // D-413: after F1's ledger refusal, the answer accept retries F1 once the user restored or removed the file; it
    // accepts no finding.
    if (e.stage === 'F1' && ledgerRefused(rep)) continue;
    for (const f of list(rep.findings)) {
      if (rep.verdict?.[f.part] !== 'fail' || INFO_CODES.includes(f.code)) continue;
      if (f.part === 'compiled') {
        fail('escalation', `escalations[${i}] accepts ${e.verdict}'s compile failure; accept isn't offered for a compile error (D-236${e.stage === 'F1' ? ', D-413' : ''})`);
        continue;
      }
      accepted.push({ gate: rep.stage, concept: e.concept, stage: typeof f.stage === 'string' ? f.stage : null, part: f.part, code: f.code, message: f.message });
    }
  }
  /** A gate failure the user accepted at an escalation (same plan stage, part and code; in schema 4 the same card) fails nothing. */
  const coveredFor = (concept) => (f) => accepted.some((a) => (!v4 || a.concept === concept) && a.stage === (f.stage ?? null) && a.part === f.part && a.code === f.code);
  for (const [file, rep] of gateReports) {
    for (const f of list(rep.findings)) {
      if (f.accepted === true && !coveredFor(rep.concept)(f)) fail('gates', `${file} marks finding ${f.code} (stage ${f.stage}) accepted, but no escalation accepted it (§5.4)`);
    }
  }

  // ---- The control flow, read from the log and tied to the verdict files it routed on --------------------
  /** The plan of the build that designs `concept`: its build folder's in schema 4, else the root's. */
  const planOf = (concept) => {
    const b = v4 ? builds.find((x) => x.id === concept) : builds[0];
    return b ? buildPlans.get(b) : null;
  };
  // FI-2 breaks the first endgame stage: the ladder's first rung (`m` when the plan has one), then plan order.
  const firstEndgameOf = (concept) => list(planOf(concept)?.stages).filter((s) => s.variant !== undefined).sort((a, b) => RUNGS.indexOf(a.variant) - RUNGS.indexOf(b.variant))[0]?.id ?? null;
  const verdictOf = (s) => gateReports.get(`reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`);
  const flowCtx = {
    schema,
    verdict: verdictOf,
    /** The plan stage a fault directive breaks (offline-and-test.md): FI-1 the card's skeleton, FI-2 the first endgame stage. */
    faultedStage: (id, concept) => (id === 'FI-1' ? skeletonStage(concept) : id === 'FI-2' ? firstEndgameOf(concept) : null),
    /**
     * D-334, D-342, D-400, D-408: the code of an R1b attempt that failed with no compile and that no retry can fix
     * (`not-a-skill`, `wrong-ascendancy`, `not-in-pin`, `not-dealt`), else null.
     */
    terminal: (s) => (s.stage === 'R1b' && s.outcome === 'fail' ? terminalR1b(verdictOf(s)) : null),
    /** Whether the run holds the card a gate answer names (C-52). */
    cardExists: (id) => cardIds.has(id),
    legacy,
  };
  if (v4) checkFlow4(log, fail, flowCtx);
  else checkFlow(log, fail, flowCtx);

  // ---- The deck and the probes (D-287, D-338, D-339), against the log ----------------------------------
  if (v3) {
    const cardOf = (id) => parseCard(readText(`cards/${id}.md`));
    // §11: a run dates as amendment-8-or-later by its rival or by its skill revision (the rounds dealt after its stamp).
    checkDeck(readText('cards.md'), stages, cardIds, fail, { rivalRan, noteOf: roundNotes(log), cardOf, heldStage });
    // D-429, D-433: each composite's Pieces table, and its Pieces measured once R1b verified it; D-436: a card verified
    // after the stamp writes amendment 11's table, its answers held to its last passing R1b verdict's `pieces[]`.
    const lastR1b = (id) => stages.reduce((at, s, i) => (s.stage === 'R1b' && s.concept === id && !idle(s) ? i : at), -1);
    checkPieceTables(stages, cardIds, cardOf, fail, {
      heldCard: (id) => lastR1b(id) >= 0 && lastR1b(id) >= heldStage,
      verdictOf: (id) => {
        const s = stages[lastR1b(id)];
        return s && s.outcome === 'pass' ? gateReports.get(`reports/gates/R1b-${id}-a${s.attempt}.json`) ?? null : null;
      },
    });
    // D-465 (amendment 13, §22): a card dealt at or after revision 13's boundary takes no rune over the budget, in or
    // scheduled, unless the brief or a gate answer names it.
    if (v4) checkOverBudgetCards(log, cardIds, cardOf, fail);
    // D-475 (Appendix A): each number a brainstorm display recorded names a card of the run.
    list(log.displays).forEach((d, k) => {
      if (!isObj(d.numbers)) return;
      for (const [n, id] of Object.entries(d.numbers)) if (!cardIds.has(id)) fail('display', `run-log.json displays[${k}] maps number ${n} to ${show(id)}, which is no card of the run (cards/<id>.md); the brainstorm display records the cards it numbered (D-475)`);
    });
    // D-408: each rival step that wrote a card, and that card; D-403, D-406: the obvious card's line, the structure check.
    checkRivals(stages, cardIds, fail, heldStage);
    checkCardLines(log, cardIds, readText, fail);
    // D-389, D-391: the cards changed and made at the gates, and the interview notes, against the checkpoints.
    checkGateCards(log, cardIds, (id) => parseCard(readText(`cards/${id}.md`)), readText('cards.md'), fail);
    checkInterviews(log, listDir('interviews'), readText, exists, questionProbes, fail);
    // D-338: each card's probes, as R1b's return counted them, are the folders under probes/<card-id>/: every
    // probe run, a probe whose compile failed included (its plan's folder stays, with no record beside it).
    const logged = new Map();
    for (const s of stages) if (s.stage === 'R1b' && isInt(s.probes)) logged.set(s.concept, (logged.get(s.concept) ?? 0) + s.probes);
    const r1bCards = new Set(stages.filter((s) => s.stage === 'R1b').map((s) => s.concept));
    for (const [id, n] of probeCounts) {
      if (!r1bCards.has(id)) fail('probes', `probes/${id}/ holds ${n} probe variant(s), but run-log.json logs no R1b for ${id}; only its R1b step writes them (D-338)`);
    }
    for (const id of r1bCards) {
      const folders = probeCounts.get(id) ?? 0;
      const sum = logged.get(id) ?? 0;
      if (sum > probeCap(id)) fail('probes', `run-log.json's R1b entries for ${id} log ${sum} probes; ${capWords(id)}`);
      if (sum !== folders) fail('probes', `run-log.json's R1b entries for ${id} log ${sum} probe(s), but probes/${id}/ holds ${folders}; the runner logs each R1b return's "probes <n>", every probe run, a probe whose compile failed included (D-338)`);
    }
    // D-286: the card the verification gate finalized gives its build its roll, its skeleton's identity.
    const finalized = v4 ? builds.map((b) => [b.id, b.roll, `builds[] ${b.id}'s roll`])
      : [[list(log.checkpoints).filter((c) => c.checkpoint === 'verification' && /^pick:/.test(String(c.answer))).map((c) => c.answer.slice(5)).pop(), log.roll, 'run-log.json roll']];
    for (const [id, roll, where] of finalized) {
      const skeleton = id !== undefined ? conceptPlans.get(id) : undefined;
      if (!isObj(roll) || !isObj(skeleton?.roll)) continue;
      const differs = ['className', 'ascendancy', 'skill'].filter((k) => roll[k] !== skeleton.roll[k]);
      if (differs.length > 0) fail('run-log', `${where} is ${show(roll)}, but the verification gate finalized ${id}, whose identity (concepts/${id}/plan.json's roll) is ${show(skeleton.roll)}; the finalized card's identity becomes ${v4 ? "its build's" : "the run's"} roll (D-286)`);
    }
  }

  // ---- Each build's artifacts, in its folder (D-412; a schema-2 or schema-3 run's one build at the root) ---------
  const ledgerModule = await loadLedgerModule();
  const otherIds = new Set(builds.filter((b) => b.folder !== '.').map((b) => b.id));
  for (const build of builds) {
    // A build's own steps: its card's (in "." also those of cards with no folder of their own), refused calls aside.
    const mine = v4 ? stages.filter((s) => s.outcome !== REFUSED && (build.folder === '.' ? !otherIds.has(s.concept) : s.concept === build.id)) : stages;
    await checkBuild({
      runFolder, build, log, schema, stages: mine, gates, gateReports, accepted: v4 ? accepted.filter((a) => a.concept === build.id) : accepted,
      ledgerModule, runName, runDate, offline, mode, ID, plan: buildPlans.get(build), sources, legacy, legacyGate,
      fail: build.folder === '.' ? fail : (rule, message) => fail(rule, `${build.folder}: ${message}`),
    });
  }
  // D-466 (amendment 13): each build writes its own file; two builds recording one PoB file (names compare without
  // case, D-52) share it.
  if (v4) {
    const seen = new Map();
    for (const b of builds) {
      if (typeof b.pobFile !== 'string' || b.pobFile.trim() === '') continue;
      const key = b.pobFile.replace(/\\/g, '/').toLowerCase();
      if (seen.has(key)) fail('run-log', `run-log.json builds[] ${b.id} records the PoB file ${show(b.pobFile)}, which build ${seen.get(key)} records too; each build writes its own file, named by its session name (D-466)`);
      else seen.set(key, b.id);
    }
  }
  // D-412: a schema-4 run with no build at the root holds no V4 report there: each build's are in its folder.
  if (v4 && !rootBuild) for (const f of listDir('reports').filter((x) => x !== 'gates')) fail('layout', `reports/${f} is at the run folder's root; a schema-4 run's V4 reports are each build's, builds/<id>/reports/V4-<n>.md (D-412)`);
  return violations;
}

/**
 * One build's artifacts in its folder (D-412): the plan, the final record and its PoB file, the guide (by the template
 * its plan decides, D-414), audit.md, the V4 reports and the round copies, the D1 gate recomputed, held to the steps the
 * log records for its card. A schema-2 or schema-3 run's one build is the root's, held to the whole log.
 */
async function checkBuild(c) {
  const { runFolder, build, log, schema, stages, gates, gateReports, accepted, ledgerModule, runName, runDate, offline, mode, ID, plan, sources, fail, legacy, legacyGate } = c;
  const v4 = schema === 4;
  const folder = build.folder;
  const { abs, exists, isDir, listDir, readText, readJson } = folderIO(path.join(runFolder, folder), fail);
  const completed = v4 ? build.status === 'completed' : log.status === 'completed';
  const covered = (f) => accepted.some((a) => a.stage === (f.stage ?? null) && a.part === f.part && a.code === f.code);
  // §22 (amendment 13): a build is held to the rules of its last D1 gate, logged at or after a revision's boundary; every
  // rule amendment 13 adds holds a build held to 13 only.
  const lastD1Entry = stages.filter((s) => s.stage === 'D1-gate' && !idle(s)).pop();
  const a13Build = v4 && lastD1Entry !== undefined && log.stages.indexOf(lastD1Entry) >= heldFrom(log, 'stages', A13);

  // A-34, D-352: each round copy is rounds/<n>/, holding the plan, the record and the guide, and nothing else. D-477
  // (amendment 13): the round copy of a build with no guide (a file-only build's claims pass) holds the plan and the record.
  if (exists('rounds') && !isDir('rounds')) fail('layout', 'rounds is a file; §2 names the folder rounds/, of round copies rounds/<n>/ (A-34)');
  for (const n of listDir('rounds').filter((x) => !ROUND_TMP.test(x))) {
    if (!ROUND_N.test(n) || !isDir(`rounds/${n}`)) fail('layout', `rounds/${n} isn't a round copy rounds/<n>/ (A-34)`);
    else if (![[...ROUND_FILES].sort(), [...ROUND_FILES_NO_GUIDE].sort()].some((want) => show(listDir(`rounds/${n}`)) === show(want))) fail('layout', `rounds/${n}/ holds ${show(listDir(`rounds/${n}`))}; a round copy holds exactly ${ROUND_FILES.join(', ')}, or ${ROUND_FILES_NO_GUIDE.join(' and ')} for a build with no guide (A-34, D-477)`);
  }
  if (v4 && folder !== '.') {
    // D-412: a build's folder holds what the root held for the one build: plan.json, the record and its XML, guide.md,
    // audit.md, reports/V4-<n>.md and rounds/<n>/.
    for (const f of listDir('.')) if (!BUILD_FILES.includes(f)) fail('layout', `${f} isn't part of a build's folder (plan.json, compile-record.json, compiled-build.xml, guide.md, audit.md, pieces.md, trades.json, reports/, rounds/; D-412, D-434, D-439)`);
  }
  if (completed) {
    for (const rel of ['plan.json', 'compile-record.json', 'guide.md', 'audit.md']) {
      if (!exists(rel)) fail('layout', `${rel} is missing; a completed ${v4 ? 'build' : 'run'} has plan.json, compile-record.json, guide.md and audit.md (§2${v4 ? ', D-412' : ''})`);
    }
  }
  if (v4 && build.status === 'file-only') for (const rel of ['plan.json', 'compile-record.json']) if (!exists(rel)) fail('layout', `${rel} is missing; a file-only build has its plan and its final record (D-411)`);

  const record = readJson('compile-record.json');
  if (isObj(record) && record.mode === 'measure-only' && !exists('compiled-build.xml')) {
    fail('layout', "compile-record.json is a measure-only record, but compiled-build.xml isn't beside it (D-208)");
  }
  const finalRecord = isObj(record) && record.mode === 'final' ? record : null;
  const planStages = isObj(plan) && Array.isArray(plan.stages) ? plan.stages.filter(isObj) : [];
  const endgame = planStages.filter((s) => s.variant !== undefined);
  const campaign = planStages.filter((s) => s.variant === undefined);
  /** D-414: the guide a plan decides: no campaign stage, the endgame guide (schema 4's); else the full guide. */
  const template = v4 && isObj(plan) && campaign.length === 0 ? 'endgame' : 'full';
  // D-414: the run log's guide field records the template its plan decides; the checker fails a mismatch.
  if (v4 && isObj(plan) && build.guide !== null && build.guide !== undefined && build.guide !== template) {
    fail('run-log', `builds[] ${build.id}'s guide is ${show(build.guide)}, but its plan ${campaign.length === 0 ? 'has no campaign stage, so its guide is the endgame guide' : `has ${campaign.length} campaign stage(s), so its guide is the full guide`}: "${template}" (D-414)`);
  }
  // Which artifacts are current, from the log (the runner can't delete files): the guide is current when no
  // design step ran after the last W1 (a revision, a fix round that escalated, or another concept's design
  // leaves an older guide behind), and the final record is current when no producer ran after the last final gate.
  const lastAt = (pred) => stages.reduce((at, s, i) => (pred(s) ? i : at), -1);
  const lastW1 = lastAt((s) => s.stage === 'W1' && s.outcome !== 'missing');
  const lastDesign = lastAt((s) => DESIGN_STAGES.includes(s.stage));
  const guideText0 = readText('guide.md');
  const guideCurrent = guideText0 !== null && (lastW1 < 0 || lastW1 > lastDesign);
  const guideText = guideCurrent ? guideText0 : null;
  if (guideText0 !== null && !guideCurrent && completed) {
    fail('layout', `status is "completed", but guide.md is from ${describe(stages[lastW1])}, and design steps ran after it; a completed ${v4 ? 'build' : 'run'} ends with a current guide`);
  }
  if (v4 && guideText !== null && (build.guide === null || build.guide === undefined)) fail('run-log', `builds[] ${build.id}'s guide is null, but its folder holds a current guide.md; the runner records the guide its plan decides, "${template}" (D-414)`);
  // A claims-only owner (D-264) compiles nothing, so it leaves the final record current.
  const lastFinalGate = lastAt((s) => FINAL_GATES.includes(s.stage) && s.outcome !== 'missing');
  const recordCurrent = finalRecord !== null && !(lastAt((s) => PRODUCERS.includes(s.stage) && s.outcome !== CLAIMS_EDITED) > lastFinalGate);
  /** The claims-only owner entries after the last final gate, whose edits the final record predates. */
  const claimsOnlyAfterFinal = stages.slice(lastFinalGate + 1).filter((s) => PRODUCERS.includes(s.stage) && s.outcome === CLAIMS_EDITED);
  if (guideText !== null && isObj(record) && !finalRecord) {
    fail('layout', `guide.md exists, but compile-record.json is a ${show(record.mode)} record; W1 writes the guide from the final compile's record (§5.3)`);
  }
  // D-352, D-365: each ledger entry's value is the plan's current formula over the record, by the server's own
  // evaluator, wherever the checker reads one: never the record's stored value, which a ledger-only fix leaves stale.
  const ledgerNow = ledgerModule !== null && isObj(plan) && isObj(record) ? ledgerResults(ledgerModule, plan, record) : {};

  // ---- Outputs and the final record (§2, §4.1 outputs; D-412 builds[]) ---------------------------------
  if (!v4 && completed && isObj(log.outputs)) {
    const o = log.outputs;
    for (const k of ['plan', 'record', 'dossier', 'guide']) {
      if (typeof o[k] !== 'string' || !exists(o[k])) fail('run-log', `outputs.${k} is ${show(o[k])}, which names no file in the run folder`);
    }
    if (finalRecord && o.pobFile !== finalRecord.pobFile?.path) fail('run-log', `outputs.pobFile is ${show(o.pobFile)}; the record's PoB file is ${show(finalRecord.pobFile?.path)}`);
  }
  if (v4 && (build.pobFile !== null && build.pobFile !== undefined ? true : ['completed', 'file-only'].includes(build.status)) && finalRecord && build.pobFile !== finalRecord.pobFile?.path) {
    fail('run-log', `builds[] ${build.id}'s pobFile is ${show(build.pobFile)}; the final record's PoB file is ${show(finalRecord.pobFile?.path)} (D-412)`);
  }
  if (finalRecord) {
    const pob = isObj(finalRecord.pobFile) ? finalRecord.pobFile : {};
    const base = path.posix.basename(String(pob.path ?? '')).replace(/\.xml$/i, '');
    // D-412: a build in its own folder writes `<slug>-<YYYY-MM-DD>-<n>-<card id>`, so two builds never share a file.
    // D-415 (the coordinator's ruling during M-21): a campaign's final compile writes a new file, the build's name and
    // `-campaign`, and leaves the endgame file F1 wrote as it was, which the user has likely saved in PoB since (D-211).
    // So a build whose final record is a D2 gate's after a campaign answer (the final gate's `campaign`, or a resume's
    // `campaign:<id>`) has the `-campaign` name; an endgame-only build's, F1's, has none.
    const campaignAsked = v4 && list(log.checkpoints).some((c) => (c.checkpoint === 'final' && c.concept === build.id && c.answer === 'campaign') || (c.checkpoint === 'verification' && c.answer === `campaign:${build.id}`));
    const lastFinal = stages.filter((s) => FINAL_GATES.includes(s.stage) && s.outcome === 'pass').pop();
    const campaignFile = campaignAsked && lastFinal?.stage === 'D2-gate';
    if (a13Build && folder !== '.') {
      // D-466 (amendment 13): the file is named by the build's session name, cleaned: `<name>`, `<name> <run date>` or
      // `<name> <run date> <k>`, a campaign's ending ` (campaign)`; never the old `<runName>-<id>`.
      const session = sessionName(runFolder, build);
      const forms = campaignFile ? '"<name> (campaign)", "<name> <date> (campaign)" or "<name> <date> <k> (campaign)"' : '"<name>", "<name> <date>" or "<name> <date> <k>"';
      if (pob.location !== 'builds' || session === null || !nameFits(base, session, runDate, campaignFile ? 'campaign' : 'final')) {
        fail('layout', `the final compile wrote ${show(pob.path)}; a build held to amendment 13 names its file by its session name ${session === null ? '(builds[].name, or its card\'s name, which the run doesn\'t hold)' : `${show(session)}, cleaned ${show(cleanName(session))}`}: ${forms}, the date the run folder's ${show(runDate)} (D-466)`);
      }
    } else {
      const name = v4 && folder !== '.' ? `${runName}-${build.id}` : runName;
      const want = campaignFile ? `${name}-campaign` : name;
      if (pob.location !== 'builds' || base !== want) {
        const why = [name !== runName ? 'then the card id (D-412)' : null, campaignFile ? "then -campaign, the campaign's own file beside the endgame one (D-415)" : null].filter(Boolean);
        fail('layout', `the final compile wrote ${show(pob.path)}; its build_name is "${want}", the run folder's last two segments joined${why.length > 0 ? `, ${why.join(', ')}` : ''} (§2)`);
      }
    }
    const compiled = Array.isArray(finalRecord.stagesCompiled) ? finalRecord.stagesCompiled : [];
    if (recordCurrent) for (const s of planStages) if (!compiled.includes(s.id)) fail('layout', `the final record didn't compile stage ${show(s.id)}`);
  }
  // D-466 (amendment 13): the draft, `<name> (draft).xml` or `<name> (draft <k>).xml`, its one home builds[].draftFile.
  if (a13Build && typeof build.draftFile === 'string' && build.draftFile.trim() !== '') {
    const session = sessionName(runFolder, build);
    const base = path.posix.basename(build.draftFile.replace(/\\/g, '/')).replace(/\.xml$/i, '');
    if (session === null || !nameFits(base, session, runDate, 'draft')) fail('layout', `builds[] ${build.id}'s draftFile is ${show(build.draftFile)}; a draft is named by the build's session name${session === null ? '' : ` ${show(cleanName(session))}`}, "<name> (draft).xml" or "<name> (draft <k>).xml" (D-466)`);
  }

  // ---- Source tags and markers of the build's plan (§7.3, C-30) -------------------------------------
  if (isObj(plan)) sources.planClaims(plan, 'plan.json');

  // ---- The V4 reports (D-352, stages/V4.md): reports/V4-<n>.md, one per logged pass (V4, V4-recheck, and schema 4's
  // V4-campaign, D-415), numbered in the build's run order from 1 and never overwritten. The k-th logged pass wrote
  // report k.
  const v4Entries = stages.map((s, i) => ({ s, i })).filter(({ s }) => V4_STAGES.includes(s.stage) && s.outcome !== 'missing');
  const passes = new Map();
  for (const f of listDir('reports')) {
    if (f === 'gates' && folder === '.') continue;
    const m = /^V4-([1-9]\d*)\.md$/.exec(f);
    if (!m || isDir(`reports/${f}`)) {
      fail('layout', `reports/${f} isn't a V4 report reports/V4-<n>.md, n from 1 (§2, D-352); a report named by its lens (v4-<lens>.json) is from before amendment 4`);
      continue;
    }
    const n = Number(m[1]);
    passes.set(n, { file: `reports/${f}`, n, entry: v4Entries[n - 1], report: parseV4Report(readText(`reports/${f}`)) });
  }
  const v4Numbers = [...passes.keys()].sort((a, b) => a - b);
  if (v4Numbers.some((n, k) => n !== k + 1)) fail('reports', `reports/ holds the V4 reports ${v4Numbers.map((n) => `V4-${n}.md`).join(', ')}; they are numbered from 1 in run order, with no gap (D-352)`);
  if (v4Entries.length > passes.size) {
    fail('reports', `run-log.json logs ${v4Entries.length} V4 pass(es) (V4, V4-recheck, V4-campaign and V4-claims), but reports/ holds ${passes.size} V4 report(s): each pass writes its own reports/V4-<n>.md and never overwrites one (D-352, D-477)`);
  } else if (passes.size > v4Entries.length) {
    fail('reports', `reports/ holds ${passes.size} V4 report(s), but run-log.json logs ${v4Entries.length} V4 pass(es) (V4, V4-recheck, V4-campaign and V4-claims); every report is a logged pass's (D-352, D-477)`);
  }
  for (const r of [...passes.values()].sort((a, b) => a.n - b.n)) r.parsed = checkV4Report(r, mode, fail, ID);
  // D-477 (amendment 13): a file-only build held to revision 13 had its claims pass, a logged V4-claims entry with its
  // report (the order, F1's pass, then V4-claims, its fix round and its re-check, is checkFlow4's); one before the
  // boundary ended at F1's pass, with none.
  if (a13Build && build.status === 'file-only' && !stages.some((s) => s.stage === 'V4-claims' && !idle(s))) {
    fail('verification', `builds[] ${build.id} ended file-only, but run-log.json logs no V4-claims entry for it: a file-only build held to amendment 13 has its claims pass after F1's pass, V4-claims, which checks every hinge claim of its plan (D-477)`);
  }

  // The concept designed last: the one whose D1 gate ran last (the log orders the files), or the only concept
  // with D1 gate reports. The gate file of a logged attempt is the one its log entry names.
  const myGates = v4 ? gates.filter((g) => stages.some((s) => s.concept === g.concept)) : gates;
  const d1Concepts = [...new Set(myGates.filter((g) => g.stage === 'D1-gate').map((g) => g.concept))];
  const lastD1GateAt = lastAt((s) => s.stage === 'D1-gate' && s.outcome !== 'missing');
  let designConcept = lastD1GateAt >= 0 ? stages[lastD1GateAt].concept : null;
  if (designConcept === null && d1Concepts.length === 1) designConcept = d1Concepts[0];
  else if (designConcept === null && d1Concepts.length > 1 && !v4) fail('reports', `D1 gate reports exist for ${d1Concepts.join(', ')}, and the run log doesn't say which ran last`);
  const lastGate = (stage, concept) => gates.filter((g) => g.stage === stage && g.concept === concept).sort((a, b) => b.attempt - a.attempt)[0];
  /** The verdict file of a gate's last logged attempt for `concept` before log index `before`, or its highest-numbered file. */
  const gateFor = (stage, concept, before = stages.length) => {
    const at = stages.slice(0, before).reduce((found, s, i) => (s.stage === stage && s.concept === concept && s.outcome !== 'missing' ? i : found), -1);
    if (at >= 0) return gates.find((g) => g.stage === stage && g.concept === concept && g.attempt === stages[at].attempt) ?? { file: `reports/gates/${stage}-${concept}-a${stages[at].attempt}.json`, stage, concept, attempt: stages[at].attempt };
    return stages.some((s) => s.stage === stage && s.concept === concept) ? undefined : lastGate(stage, concept);
  };
  // The concept the current guide is for: its last W1's.
  const guideConcept = guideText !== null ? (lastW1 >= 0 ? stages[lastW1].concept : designConcept) : null;
  const guideBefore = lastW1 >= 0 ? lastW1 : stages.length;
  // The V4 reports of the current guide: the passes logged for its card after the last step about another card
  // (an earlier design's reports aren't held to the current plan).
  const lastOther = guideConcept === null ? stages.length : lastAt((s) => typeof s.concept === 'string' && s.concept !== guideConcept);
  const guideReports = [...passes.values()].filter((r) => r.entry !== undefined && r.entry.i > lastOther && r.entry.s.concept === guideConcept).sort((a, b) => a.n - b.n);
  if (guideText !== null) {
    if (guideConcept === null || !gateFor('D1-gate', guideConcept, guideBefore)) fail('reports', 'guide.md exists, but no reports/gates/D1-gate-<concept>-a<n>.json does; W1 runs only after the D1 gate passed (§5.3)');
    // D-413: the final compile W1 writes from is the D2 gate's, or, for an endgame-only build, F1's.
    else if (!gateFor('D2-gate', guideConcept, guideBefore) && !(v4 && gateFor('F1', guideConcept, guideBefore))) fail('reports', `guide.md exists, but no reports/gates/D2-gate-${guideConcept}-a<n>.json${v4 ? ` or reports/gates/F1-${guideConcept}-a<n>.json` : ''} does; W1 runs only after the ${v4 ? 'final compile (the D2 gate, or F1)' : 'D2 gate'} passed (§5.3${v4 ? ', D-413' : ''})`);
    if (!guideReports.some((r) => r.parsed?.check === 'full')) fail('reports', `guide.md exists, but no V4 full pass of it does (a reports/V4-<n>.md "full pass" logged as V4 for ${guideConcept}); every guide gets one full pass (D-352)`);
  }
  // A re-check (D-352, A-34): of the round copy rounds/<n-1>/, it reports again every finding the report before it
  // left open, and its "## Checked" lists every item `--changed <n-1>` prints: the claims and guide H2s that changed
  // since that copy, as they stood when it ran (rounds/<n>/ when a later round copied them, else the run folder,
  // once no step wrote the plan, the record or the guide after it). The runner's step-14 Known issues lines are no
  // change: they come after the re-check. D-415: a campaign pass is of rounds/<n-1>/ too, and covers every guide H2
  // --changed lists, the campaign's new and changed H2s.
  const PASS_WRITERS = [...DESIGN_STAGES, 'W1'];
  for (const r of [...passes.values()].sort((a, b) => a.n - b.n)) {
    const check = r.parsed?.check;
    if (check !== 'recheck' && check !== 'campaign') continue;
    const prev = passes.get(r.n - 1);
    if (check === 'recheck' && prev?.parsed) {
      const ids = new Set(r.parsed.findings.map((f) => f.id));
      for (const f of prev.parsed.findings.filter((x) => x.status === 'unresolved')) {
        if (!ids.has(f.id)) fail('recheck', `${r.file} doesn't report ${prev.file}'s unresolved finding ${f.id} again; a re-check reports every finding still open under its id, fixed or unresolved (stages/V4.md)`);
      }
    }
    if (!isDir(`rounds/${r.n - 1}`)) {
      fail('recheck', `${r.file} is a ${check === 'campaign' ? 'campaign pass' : 're-check'} of rounds/${r.n - 1}, but rounds/${r.n - 1}/ doesn't exist; the runner makes the round copy (--snapshot ${r.n - 1}${v4 && folder !== '.' ? ` --build ${build.id}` : ''}) before ${check === 'campaign' ? 'the campaign (D-415)' : 'the fix round or revision (A-34)'}`);
      continue;
    }
    let now = null;
    if (isDir(`rounds/${r.n}`)) now = abs(`rounds/${r.n}`);
    else if (r.entry && !stages.slice(r.entry.i + 1).some((s) => PASS_WRITERS.includes(s.stage) && s.outcome !== 'missing')) now = abs('.');
    if (now === null || ledgerModule === null) continue;
    const want = changedBetween(ledgerModule, abs(`rounds/${r.n - 1}`), now, { knownIssues: false }).filter((line) => check === 'recheck' || line.startsWith('section '));
    const checked = new Set(r.parsed.checked);
    for (const line of want) {
      if (!checked.has(line)) fail('recheck', `${r.file}'s "## Checked" misses "${line}", which check-run.mjs --changed ${r.n - 1} lists (it changed since rounds/${r.n - 1}/); a ${check === 'campaign' ? 'campaign pass covers every guide H2' : 're-check covers every item'} --changed lists (D-352${check === 'campaign' ? ', D-415' : ''})`);
    }
  }

  // ---- Open V4 findings (D-352): the unresolved findings of the guide's highest-numbered report ------------
  // A re-check reports again every finding still open, so the last report holds them all (fix-round.md, step 14).
  const lastReport = guideText !== null ? guideReports[guideReports.length - 1] : undefined;
  const open = (lastReport?.parsed?.findings ?? []).filter((f) => f.status === 'unresolved').map((f) => ({ ...f, file: lastReport.file }));

  // ---- Guide (§8: the reader layer, D-276; D-414's endgame guide) and the audit layer (§7.8, D-278) --------------
  // The guide renders the plan: it carries no markers, so the plan's claims hold its sources.
  let guide = null;
  let audit = null;
  const wantH2 = template === 'endgame' ? ENDGAME_GUIDE_H2 : GUIDE_H2;
  const cap = template === 'endgame' ? ENDGAME_WORD_CAP : WORD_CAP;
  const which = template === 'endgame' ? "the endgame guide's (D-414)" : '§8';
  if (guideText !== null) {
    guide = parseMarkdown(guideText);
    const h1 = guide.headings.filter((h) => h.level === 1);
    const roll = isObj(v4 ? build.roll : log.roll) ? (v4 ? build.roll : log.roll) : {};
    if (h1.length !== 1) fail('guide-sections', `guide.md has ${h1.length} H1s; it has one, naming the roll (§8)`);
    else if (!norm(h1[0].title).includes(norm(roll.ascendancy ?? '')) || !norm(h1[0].title).includes(norm(roll.skill ?? ''))) {
      fail('guide-sections', `guide.md's H1 "${h1[0].title}" doesn't name the roll ${roll.ascendancy} / ${roll.skill}`);
    }
    // (b) The reader layer's H2s, in order, and no other (D-276, D-283): the full guide's 14, the endgame guide's 12.
    const titles = guide.h2.map((h) => h.title);
    if (show(titles) !== show(wantH2)) {
      const missing = wantH2.filter((t) => !titles.includes(t));
      const extra = titles.filter((t) => !wantH2.includes(t));
      const why = missing.length > 0 ? `missing ${show(missing)}` : extra.length > 0 ? `unexpected ${show(extra)}` : 'out of order';
      fail('guide-sections', `guide.md's H2s are ${why}; ${which === '§8' ? '§8 wants' : `${which} H2s are`} ${show(wantH2)} in that order${template === 'endgame' ? ': its plan has no campaign stage' : ''}`);
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

    // (v) The word cap: at most 3,000 words (the endgame guide 2,300, D-414), the H1, the import code and the Known
    // issues list not counted (D-283).
    const kiH3 = showH3.find((h) => h.title === KNOWN_ISSUES) ?? null;
    const ki = kiH3 ? guide.sectionOf(kiH3) : null;
    const words = countWords(guide.lines, (i) =>
      h1.some((h) => h.line === i) || (importBlock !== null && i >= importBlock.start && i <= importBlock.end) || (ki !== null && i > ki.start && i < ki.end));
    if (words > cap) {
      fail('word-cap', `guide.md has ${words} words, over the ${cap}-word cap${template === 'endgame' ? " of the endgame guide (D-414)" : ''} (the H1, the import code and the Known issues list not counted; D-276, D-283)`);
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

  // The audit layer (§7.8, D-278, D-355): audit.md beside a current guide, with its six H2s, and equal to what
  // render-audit.mjs renders from the current plan, final record and last D1 gate verdict file, Known issues aside
  // (the render keeps the lines under them). The runner re-renders it before every W1, so it is never stale.
  const auditText = readText('audit.md');
  let auditInputs = null;
  if (guideText !== null) {
    if (auditText === null) fail('audit-sections', `guide.md exists, but audit.md doesn't; the runner renders it with scripts/render-audit.mjs${v4 ? ` --build ${build.id}` : ''} before W1 (§7.8, D-355)`);
    else {
      audit = parseMarkdown(auditText);
      const titles = audit.h2.map((h) => h.title);
      if (show(titles) !== show(AUDIT_H2)) {
        const missing = AUDIT_H2.filter((t) => !titles.includes(t));
        const extra = titles.filter((t) => !AUDIT_H2.includes(t));
        const why = missing.length > 0 ? `missing ${show(missing)}` : extra.length > 0 ? `unexpected ${show(extra)}` : 'out of order';
        fail('audit-sections', `audit.md's H2s are ${why}; §7.8 wants ${show(AUDIT_H2)} in that order (D-278, D-355)`);
      }
      try {
        auditInputs = await loadAuditInputs(runFolder, v4 ? build.id : undefined);
      } catch (e) {
        fail('audit-render', `audit.md can't be compared with its render: ${e.message} (D-355)`);
      }
      const diff = auditInputs !== null ? firstDifference(auditText.split(/\r?\n/), renderAudit(auditInputs).split('\n')) : null;
      if (diff !== null) {
        fail('audit-render', `audit.md:${diff.n} is ${show(diff.got)}, but render-audit.mjs renders ${show(diff.want)} from the current plan.json, compile-record.json and D1 gate verdict file: audit.md is the render, Known issues aside; the runner re-renders it before W1 (D-355)`);
      }
    }
  }

  if (guide !== null) {
    // D-355: each rung's Checks block is its block in audit.md's render, which W1 copies verbatim.
    for (const b of auditInputs !== null ? checksBlocks(auditInputs) : []) {
      const text = checksText(guide, b.variant);
      if (text === null) continue;
      const diff = firstDifference(text.split('\n').filter((l) => l.trim() !== ''), b.lines.filter((l) => l.trim() !== ''), (l) => l.trim());
      if (diff !== null) {
        fail('checks-block', `guide.md's "${VARIANT_H2[b.variant]}" Checks, line ${diff.n} of the block, is ${show(diff.got)}, but its block in render-audit.mjs's render (audit.md's "### ${b.loadoutName}") has ${show(diff.want)}; W1 copies the block verbatim (D-355)`);
      }
    }
    // (x) One fixed-form verdict line per endgame rung, each part compared with the record (D-283).
    const guideD1 = guideConcept !== null ? gateFor('D1-gate', guideConcept, guideBefore) : undefined;
    checkVerdictLines(guide, endgame, record, guideD1 ? gateReports.get(guideD1.file) : null, ledgerNow, fail, schema !== 2, plan);
    // D-452 (amendment 12): each schema-8 stage's tree-change line, its counts the record's treeChange.
    checkTreeChangeLines(guide, planStages, record, fail);
    // (l) Known issues by sentence in the guide, with each finding's id in audit.md (D-276, D-283).
    checkKnownIssues(guide, audit, accepted, open, fail);
  }

  // ---- Campaign rewards (D-265 c): every reward choice the campaign passes is picked, and the guide says so ----
  if (isObj(plan) && campaign.length > 0) checkRewardPicks(planStages, campaign, guide, fail);
  // D-413, D-414: a plan with no campaign stage carries every reward choice the campaign offers on every rung, D1's
  // picks, and its endgame guide's Switching over names each; a design from before amendment 9 (a migrated run's, its
  // D1 gate schema 3's) made none.
  const d1Last = designConcept !== null ? gateFor('D1-gate', designConcept) : undefined;
  if (v4 && isObj(plan) && campaign.length === 0 && endgame.length > 0 && d1Last && !legacyGate(d1Last.file)) checkEndgameRewardPicks(endgame, guide, fail);

  // accepted-offline (C-30, stages/V4.md): only for a claim tagged external-unavailable, which the location names. A
  // report is held to the plan as it was when it ran (D-265 a): the round copy rounds/<n>/ made after it, or the
  // current plan.json while no step has written it since; else its locations can't be checked.
  for (const r of guideText !== null ? guideReports : []) {
    const offlineFindings = (r.parsed?.findings ?? []).filter((f) => f.status === 'accepted-offline');
    if (offlineFindings.length === 0) continue;
    let planThen = null;
    if (isDir(`rounds/${r.n}`)) planThen = readJson(`rounds/${r.n}/plan.json`);
    else if (!stages.slice(r.entry.i + 1).some((s) => ARTIFACT_WRITERS['plan.json'].includes(s.stage) && s.outcome !== 'missing')) planThen = plan;
    if (!isObj(planThen)) continue;
    for (const f of offlineFindings) {
      const claim = f.artifact === 'plan.json' ? claimAt(planThen, f.location) : null;
      if (!claim || claim.kind !== 'external-unavailable') {
        fail('report-shape', `${r.file}: ${f.id} is accepted-offline, but ${show(f.artifact)} ${show(f.location)} names ${claim ? `a ${claim.kind} claim` : 'no claim'}; only a claim tagged external-unavailable is accepted offline (C-30)`);
      }
    }
  }

  // ---- The D1 gate, recomputed from the plan and the record (Q3; AC-W2 o, p, q, u) ------------------
  const ruleOf = (part) => (part === 'rolledSkill' ? 'rolled-skill' : ['floor', 'budget'].includes(part) ? part : 'gates');
  // The last D1 gate of the concept designed last. Only the budget may be unverified (D-164), and in schema 4 the tree
  // (D-419: get_node_power failed, or the call was refused): a gate whose compile ran reads every other part from its
  // record, and a gate that didn't fail has that record.
  const d1 = d1Last;
  const d1rep = d1 ? gateReports.get(d1.file) : null;
  const holdsEndgame = isObj(record) && isObj(record.stages) && endgame.length > 0 && endgame.every((s) => isObj(record.stages[s.id]?.outputs));
  const compileFailed = isObj(d1rep) && isObj(d1rep.verdict) && d1rep.verdict.compiled === 'fail';
  if (d1 && isObj(d1rep) && isObj(d1rep.verdict) && !compileFailed) {
    for (const part of GATE_PARTS['D1-gate'].filter((x) => x !== 'budget')) {
      if (d1rep.verdict[part] === 'unverified') fail(ruleOf(part), `${d1.file} says ${part}: "unverified"; only the budget${v4 ? ' and the tree' : ''} may be unverified: a gate whose compile ran reads every other part from its record (gates.md)`);
    }
    if (!isObj(plan)) fail('layout', `${d1.file} exists, but plan.json doesn't; the gate can't be recomputed`);
    else if (!holdsEndgame) fail('gates', `${d1.file} doesn't fail its compile, but compile-record.json holds no values for the endgame stages; a gate that didn't fail has its compile's record`);
  }
  // The recompute runs whenever the record holds the endgame values. The gate's own verdict is compared only
  // when its compile ran and no D1 rewrote the plan after it; a current guide's concept passes it outright.
  if (isObj(plan) && holdsEndgame && (guideText !== null || (d1 && isObj(d1rep) && isObj(d1rep.verdict)))) {
    const said = (part) => (isObj(d1rep?.verdict) ? d1rep.verdict[part] : undefined);
    const gateFresh = d1 && isObj(d1rep) && !compileFailed && stages.findLastIndex((s) => D1_STAGES.includes(s.stage) && s.outcome !== CLAIMS_EDITED) < lastD1GateAt;
    const parts = {
      floor: recomputeFloor(endgame, record, guide, fail),
      // D-371, D-373: the gate's market, totals and over-target findings are held to the recompute while it is fresh.
      budget: recomputeBudget(endgame, plan, isObj(d1rep) ? d1rep : {}, gateFresh ? d1.file : null, fail, a13Build),
      rolledSkill: recomputeRolledSkill(endgame, plan, record, isObj(d1rep) ? d1rep : {}, ledgerNow, fail),
    };
    for (const [part, got] of Object.entries(parts)) {
      const openFailures = got.failures.filter((f) => !covered(f));
      const effective = openFailures.length > 0 ? 'fail' : got.verdict === 'fail' ? (got.unverified ? 'unverified' : 'pass') : got.verdict;
      const why = got.failures.map((f) => f.why).join('; ');
      // The gate's verdict must agree with the records (accepted failures may be counted either way).
      if (gateFresh && (['pass', 'fail'].includes(said(part)) || part === 'budget')) {
        if (said(part) !== got.verdict && said(part) !== effective) fail(ruleOf(part), `${d1.file} says ${part}: ${show(said(part))}, but the records give ${show(got.verdict)}${why ? `: ${why}` : ''}`);
      }
      // A guide is written only after the gate passed: no recomputed failure stands unless accepted.
      if (guideText !== null) for (const f of openFailures) fail(ruleOf(part), `the guide's concept fails the D1 gate's ${part} (${f.code}, stage ${f.stage}): ${f.why}; only a pass, or an unverified budget, proceeds to ${v4 ? 'the final compile' : 'D2'} (§5.3)`);
    }
  }
  // ---- Amendment 11 (D-439…D-441, D-447, D-448): the design field's figures, toughness, boss line, floor and trades,
  // and the boss estimate's ledger rules, for a build whose last D1 gate is held to amendment 11's rules (§19) ---------
  const d1At = d1 ? stages.findLastIndex((s) => s.stage === 'D1-gate' && s.concept === d1.concept && s.attempt === d1.attempt) : -1;
  const a11Build = d1At >= 0 && log.stages.indexOf(stages[d1At]) >= heldFrom(log);
  // Amendment 12 (§22): a build held to revision 12's rules by its last D1 gate, logged at or after 12's boundary.
  const a12Build = d1At >= 0 && log.stages.indexOf(stages[d1At]) >= heldFrom(log, 'stages', 12);
  const tradesFile = readJson('trades.json');
  if (tradesFile !== null) checkTradesFile(tradesFile, endgame, fail, a12Build, a13Build);
  if (a11Build && isObj(plan)) {
    // A producer after the gate (a D1 step that compiled, or D2) leaves its design field older than the plan and the record.
    const fresh = !stages.slice(d1At + 1).some((s) => PRODUCERS.includes(s.stage) && s.outcome !== CLAIMS_EDITED && !idle(s));
    checkBossLedger(endgame, plan, record, fail);
    const trades = isObj(tradesFile) ? list(tradesFile.trades) : null;
    if (isObj(d1rep?.design)) checkDesignField({ file: d1.file, design: d1rep.design, endgame, plan, record, ledgerNow, trades, fresh, fail, a12: a12Build, a13: a13Build });
    if (a12Build) {
      checkDefencePlan(plan, endgame, fail);
      if (isObj(d1rep?.design)) checkDesignField12({ file: d1.file, design: d1rep.design, endgame, plan, record, fresh, fail });
    }
    // Amendment 13 (D-467, D-468, D-473): the design field's tree search and boss target, against the plan's tree.start,
    // tree.end and tree.search.
    if (a13Build && isObj(d1rep?.design)) checkDesignField13({ file: d1.file, design: d1rep.design, endgame, plan, record, fresh, fail });
  }
  // Amendment 13 (§22): the runes over the budget in the plan (D-465), corruption (D-471), and flasks and charms (D-472), for
  // a build whose last D1 gate is held to revision 13.
  if (a13Build && isObj(plan)) {
    checkOverBudgetPlan(planStages, userWords(log), fail);
    checkCorruption({ plan, planStages, gate: isObj(d1rep) ? d1rep : null, guide: guideText, offline, fail });
    checkFlasks(planStages, fail);
  }

  // S7: a stage with the named damage source (its group is `rolledGroup`, D-295) makes it the main skill, so the
  // PoB file opens on it.
  for (const s of campaign) {
    if (s.skills?.rolledGroup !== undefined && s.skills?.main?.group !== s.skills.rolledGroup) {
      fail('rolled-skill', `campaign stage ${s.id}'s main group is ${show(s.skills?.main?.group)}, but its rolledGroup is ${s.skills.rolledGroup}; a stage with the named damage source makes it the main skill (S7)`);
    }
  }
  // Once a guide is current, the D1 gate and the final compile it rests on (the last attempts before its W1) passed:
  // a failing part stands only where accepted findings cover it.
  if (guideText !== null && guideConcept !== null) {
    for (const stage of ['D1-gate', ...FINAL_GATES]) {
      const g = gateFor(stage, guideConcept, guideBefore);
      const rep = g ? gateReports.get(g.file) : null;
      if (!isObj(rep) || !isObj(rep.verdict)) continue;
      for (const part of partsOf(rep, stage)) {
        // The budget never fails (D-371): a `fail` there is an unknown value, which the gate-report check names.
        if (rep.verdict[part] !== 'fail' || part === 'budget') continue;
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
        // D-440: an information-only code (a boots exception, `boots-exception`) fails nothing, like the chaos exception.
        const openFindings = (Array.isArray(verdict.findings) ? verdict.findings : []).filter((f) => !INFO_CODES.includes(f?.code) && !covered({ stage: id, part: check, code: f?.code }));
        if (openFindings.length > 0) fail('record-verdicts', `the final record's stage ${id} fails ${check.toUpperCase()}: ${openFindings.map((f) => f?.code).join(', ')}`);
      }
    }
  }
  // D-264: a claims-only owner (claims-edited) compiles nothing, so the record is still the final compile the last
  // final gate ran, whatever the owner edited: claims, sources and the ledger (D-352).
  if (claimsOnlyAfterFinal.length > 0 && lastFinalGate >= 0) {
    const who = claimsOnlyAfterFinal.map(describe).join(', ');
    const gate = stages[lastFinalGate];
    const named = gateReports.get(`reports/gates/${gate.stage}-${gate.concept}-a${gate.attempt}.json`)?.finalCompile?.pobFile;
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
        fail('record-plan', `sha1(plan.json) is ${planSha1}, but the final record's planSha1 is ${show(finalRecord.planSha1)}: plan.json changed after the final compile, and no claims-only owner (${CLAIMS_EDITED}) ran after it`);
      }
    } else if (isObj(plan)) {
      // D-264, D-266, D-352: claims and ledger entries edited in place after the final compile change plan.json's
      // sha1, never its build: the projection without stages[].claims, the ledger and the source and tag fields
      // (WU-65's src/plan/buildHash.ts) is still the one the final compile built, its sha1 the record's buildSha1.
      // A record without one predates D-266 and can't show it.
      const who = claimsOnlyAfterFinal.map(describe).join(', ');
      const hash = await loadBuildHashModule();
      if (hash === null) {
        fail('record-plan', `the server's build projection ${path.relative(REPO, buildHashModulePath())} is missing; build the server (pnpm build) to check ${who}'s claims-only edit`);
      } else if (typeof finalRecord.buildSha1 !== 'string') {
        fail('record-plan', `${who} edited claims without a compile (${CLAIMS_EDITED}), but the final record has no buildSha1 to hold the plan's build to (D-266)`);
      } else if (hash.buildSha1(plan) !== finalRecord.buildSha1) {
        fail('record-plan', `${who} edited claims without a compile (${CLAIMS_EDITED}), but plan.json's build changed: the sha1 of its build-affecting part (everything but stages[].claims, the ledger, the source and tag fields and each price's note) is ${hash.buildSha1(plan)}, and the final record's buildSha1 is ${show(finalRecord.buildSha1)}; only a recompile changes the build: gear, tree, gems or config (D-264, D-266, D-352, D-386)`);
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
    // (t) D-352, D-365: the ledger is the checker's. Every entry's current formula evaluates over the final record
    // with the server's own evaluator; an entry that doesn't evaluate fails. A claim citing an entry states its
    // value or its inputs: a claim with numbers holds one that matches the value, at its own last significant
    // digit or within 5%, an estimate's tolerance (D-352), or equals one of the entry's current input values or
    // that value × 100 (a percentage); so a formula changed under its claim (FI-4's doubling) fails here.
    if (ledgerModule === null) {
      fail('ledger', `the server's ledger evaluator ${path.relative(REPO, ledgerModulePath())} is missing; build the server (pnpm build) to evaluate the ledger`);
    } else {
      for (const e of plan.ledger.filter((x) => isObj(x) && typeof x.id === 'string')) {
        const r = ledgerNow[e.id];
        if (!isNum(r?.value)) fail('ledger', `ledger entry ${e.id} doesn't evaluate over the final record: ${r?.error ?? 'its formula is missing'} (D-365)`);
      }
      const entries = new Map(plan.ledger.filter((x) => isObj(x) && typeof x.id === 'string').map((x) => [x.id, x]));
      const num = (w) => Number(w.replace(/,/g, '').replace(/−/g, '-'));
      const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
      planStages.forEach((s, i) => list(s.claims).forEach((cl, k) => {
        const id = /^ledger:(\S+)$/.exec(typeof cl.source === 'string' ? cl.source : '')?.[1];
        const value = id !== undefined ? ledgerNow[id]?.value : undefined;
        if (!isNum(value)) return;
        const inputs = list(entries.get(id)?.inputs).filter((x) => isObj(x) && isNum(x.value));
        const written = [...String(cl.text ?? '').matchAll(/[−-]?\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0]);
        const near = (w) => matchesWritten(w, value) || Math.abs(num(w) - value) <= 0.05 * Math.abs(value);
        const input = (w) => inputs.some((x) => same(num(w), x.value) || same(num(w), x.value * 100));
        if (written.length > 0 && !written.some((w) => near(w) || input(w))) {
          const ins = inputs.length > 0 ? ` and its inputs are ${inputs.map((x) => `${x.name} ${x.value}`).join(', ')}` : '';
          fail('ledger', `plan.json stages[${i}].claims[${k}] (${cl.id}) cites ledger:${id}, whose current formula gives ${round2(value)} over the final record${ins}, but the claim states ${written.join(', ')}; a claim citing a ledger entry states its value or its inputs (D-365)`);
        }
      }));
    }
  }
}

/**
 * D-412: what a build's folder `builds/<id>/` holds (the root's files for its one build); D-434: D1-build's `pieces.md`;
 * D-439: the trades D1-tree and D1-finish write for the design gate, `trades.json`.
 */
const BUILD_FILES = ['plan.json', 'compile-record.json', 'compiled-build.xml', 'guide.md', 'audit.md', 'pieces.md', 'trades.json', 'reports', 'rounds'];
/**
 * The V4 passes a build's reports/V4-<n>.md number: the full pass, a re-check, schema 4's campaign pass (D-415), and
 * amendment 13's claims pass of a file-only build (D-477).
 */
const V4_STAGES = ['V4', 'V4-recheck', 'V4-campaign', 'V4-claims'];
/** A gate verdict's parts: its stage's, and in schema 4 the D1 gate's `tree` (D-419) when the verdict has it. */
const partsOf = (rep, stage) => (stage === 'D1-gate' && isObj(rep?.verdict) && 'tree' in rep.verdict ? D1_PARTS4 : GATE_PARTS[stage] ?? []);
/** D-413: whether an F1 verdict is the write ledger's refusal (D-211), which escalates at once. */
const ledgerRefused = (rep) => list(rep?.findings).some((f) => f.code === LEDGER_REFUSED);
/** D-421: whether a gate verdict carries a refused tool call: it routes to no producer, and the gate re-runs alone. */
const toolRefused = (rep) => list(rep?.findings).some((f) => f.code === TOOL_REFUSED);

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

/**
 * D-413, D-414: for a plan with no campaign stage, D1 makes the campaign's reward picks: every rung carries the same pick
 * for each reward choice the campaign offers (data/campaign/progress.json), a `config.scenario` (or earned) entry of
 * its option with one of its values, and the endgame guide's `Switching over` names each pick by its first line.
 */
function checkEndgameRewardPicks(endgame, guide, fail) {
  const { choices } = rewardChoices();
  const h2 = guide ? h2Named(guide, SWITCHING_H2) : null;
  for (const c of choices) {
    const picks = endgame.map((s) => ({ id: s.id, value: [...list(s.config?.earned), ...list(s.config?.scenario)].find((o) => o.option === c.option)?.value }));
    const unpicked = picks.filter((p) => !c.options.includes(p.value));
    if (unpicked.length > 0) {
      fail('campaign-rewards', `rung${unpicked.length === 1 ? '' : 's'} ${unpicked.map((p) => p.id).join(', ')} of a plan with no campaign stage pick${unpicked.length === 1 ? 's' : ''} no reward for ${c.quest}: D1 makes each reward choice the campaign offers, option ${show(c.option)} with one of the ${c.options.length} values of data/campaign/progress.json#${c.quest}.options in config.scenario, on all three rungs (D-413)`);
      continue;
    }
    const values = [...new Set(picks.map((p) => p.value))];
    if (values.length > 1) {
      fail('campaign-rewards', `rungs ${picks.map((p) => p.id).join(', ')} pick ${c.quest}'s reward ${values.length} different ways; the player picks once, so every rung carries the same pick (D-413)`);
      continue;
    }
    if (!guide) continue;
    const first = String(values[0]).split('\n')[0].trim();
    if (!h2 || !norm(sectionText(guide, h2)).includes(norm(first))) {
      fail('campaign-rewards', `the plan picks ${show(values[0])} for ${c.quest}, but guide.md's "${SWITCHING_H2}" doesn't name it by its first line "${first}"; the endgame guide names every pick there (D-413, D-414)`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// The reader layer's number check and its Known issues (D-276, D-283)
// ---------------------------------------------------------------------------------------------------

/** D-283, D-294: the verdict line's fixed form, as the guide template gives it. */
const VERDICT_FORM = '- **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <n> DPS. Effective HP about <n>.';
/**
 * D-437, D-447 (amendment 11, Appendix A): the verdict line's fixed form once the record measures both figures, its damage
 * part `<Skill> about <map> DPS against map monsters, about <boss> against a Pinnacle boss.`, `<boss>` the boss figure.
 */
const VERDICT_FORM_A11 = '- **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <map> DPS against map monsters, about <boss> against a Pinnacle boss. Effective HP about <n>.';
/**
 * D-454 (amendment 12, Appendix A): the verdict line's fixed form once the record measures the resisting figure, its
 * damage part `<Skill> about <map> DPS against map monsters, about <resisting> against resisting rares, about <boss>
 * against a Pinnacle boss.`
 */
const VERDICT_FORM_A12 = '- **<Entering maps|Budget|Non-budget> (L<level>): <solid|watch|risky>.** Resistances <fire>/<cold>/<lightning>/<chaos>% at −60%. Max hit <n> physical against about <hit>, and at least <n> elemental or chaos against about <hit>. <Skill> about <map> DPS against map monsters, about <resisting> against resisting rares, about <boss> against a Pinnacle boss. Effective HP about <n>.';
/** D-353: the survival label on the budget and non-budget rungs, in place of solid, watch or risky: the record's Arbiter verdict. */
const ARBITER_LABEL = "<survives the Arbiter's hits|one-shot by the Arbiter's <the worst hit>>";
/**
 * D-459 (amendment 12, Appendix A): the label's three forms once the record's Arbiter rows carry hits survived, from the
 * deciding row: `<x>` its hits survived rounded down to a whole percent, the parenthesis only when x is above 0.
 */
const ARBITER_LABEL_A12 = "<survives the Arbiter's hits|survives <x>% of the Arbiter's <type> hits, by evading or deflecting them|one-shot by the Arbiter's <type> hit (it survives <x>% of them)>";
/** The verdict line's form on a rung: `m` keeps the judgment label; `b` and `n` carry the Arbiter's (D-353). */
const verdictForm = (variant, two = false, three = false, label = ARBITER_LABEL) => ((f) => (variant === 'entering-maps' ? f : f.replace('<solid|watch|risky>', label)))(three ? VERDICT_FORM_A12 : two ? VERDICT_FORM_A11 : VERDICT_FORM);
/**
 * D-353, D-459: the survival label a record's `measures.arbiter` gives: in the three forms (render-audit.mjs's
 * `arbiterLabel12`) when its rows carry hits survived, read against `floor`; else amendment 11's (`arbiterLabel`).
 */
const labelOf = (arbiter, floor) => (hasHitsSurvived(arbiter) ? arbiterLabel12(arbiterReading(arbiter, floor)) : arbiterLabel(arbiter));

/**
 * D-353, templates/guide-template.md: the survival label `measures.arbiter` gives the budget and non-budget rungs:
 * "survives the Arbiter's hits"; "one-shot by the Arbiter's <type> hit", `<type>` the worst hit's type, a mixed
 * hit's types joined by " and "; "not measured against the Arbiter" for a null verdict.
 */
export function arbiterLabel(arbiter) {
  if (!isObj(arbiter) || !['survives', 'one-shot'].includes(arbiter.verdict)) return 'not measured against the Arbiter';
  if (arbiter.verdict === 'survives') return "survives the Arbiter's hits";
  return isObj(arbiter.worst) && typeof arbiter.worst.type === 'string' ? `one-shot by the Arbiter's ${arbiter.worst.type.split('-').join(' and ')} hit` : 'not measured against the Arbiter';
}
/** D-326: a schema-2 run's guide predates D-294's Effective HP, so its verdict line may end at the DPS. */
const EHP_PART = ' Effective HP about <n>.';
const NUM = '[−-]?\\d[\\d,]*(?:\\.\\d+)?';
/**
 * D-437, D-447 (Appendix A): the damage part with two figures, `<Skill> about <map> DPS against map monsters, about
 * <boss> against a Pinnacle boss.`, in place of `<Skill> about <n> DPS.` (which a guide written from a record before
 * amendment 11 keeps).
 */
const VERDICT_LINE = new RegExp(
  `^[-*] \\*\\*(Entering maps|Budget|Non-budget) \\(L(\\d+)\\): ([^*]+?)\\.\\*\\* Resistances (${NUM})/(${NUM})/(${NUM})/(${NUM})% at [−-]60%\\. ` +
    `Max hit (${NUM}) physical against about (${NUM}), and at least (${NUM}) elemental or chaos against about (${NUM})\\. (.+?) about (${NUM}) DPS(?: against map monsters,(?: about (${NUM}) against resisting rares,)? about (${NUM}) against a Pinnacle boss)?\\.` +
    `(?: Effective HP about (${NUM})\\.)?$`,
);
const OTHER_TYPES = ['Fire', 'Cold', 'Lightning', 'Chaos'];

/**
 * D-283's one number check: each endgame rung has one verdict line in `Survival by stage`, found by its label,
 * in the fixed form, and each written part matches the record by the rounding rule (`matchesWritten`): the level
 * the stage's `level`; the resistances `FireResist`, `ColdResist`, `LightningResist`, `ChaosResist`; the
 * physical max hit `PhysicalMaximumHitTaken` against the hit the compiler wrote, `enemyPhysicalDamage` in the
 * record's `configWritten` (D-353); the other max hit the least of the four other `<Type>MaximumHitTaken` against
 * the largest of the four other hits written there; the DPS the stage's `measures.dps` (D-353), or, in a record
 * from before it, the named damage source's figure the D1 gate's verdict names, × its Count where the record has
 * a counted copy (D-294, D-340), a ledger figure's value its current formula's (D-365); and the closing "Effective HP about <n>." the stage's `TotalEHP` (D-294), which a schema-3
 * run's line always has. The entering-maps label stays judgment (solid, watch or risky); the budget and non-budget
 * labels are the record's `measures.arbiter` verdict (D-353, `arbiterLabel`).
 */
function checkVerdictLines(guide, endgame, record, d1rep, ledgerNow, fail, v3, plan = null) {
  const h2 = h2Named(guide, SURVIVAL_H2);
  if (!h2) return;
  const { start, end } = guide.sectionOf(h2);
  const lines = guide.lines.slice(start + 1, end).map((text, k) => ({ text: text.trim(), n: start + k + 2 }));
  const where = `guide.md's "${SURVIVAL_H2}"`;
  const labels = new Set(endgame.map((s) => VARIANT_LABEL[s.variant]).filter(Boolean));
  // D-459 (amendment 12): the floor the three label forms read, from references/toughness-targets.json.
  const floor = arbiterFloor() ?? ARBITER_FLOOR;
  for (const label of Object.values(VARIANT_LABEL)) {
    if (!labels.has(label) && lines.some((l) => l.text.startsWith(`- **${label} (L`))) fail('verdict-line', `${where} has a verdict line for the ${label} rung, but the plan has no such rung (D-283)`);
  }
  for (const s of endgame) {
    const label = VARIANT_LABEL[s.variant];
    if (!label) continue;
    const mine = lines.filter((l) => l.text.startsWith(`- **${label} (L`));
    const st0 = isObj(record?.stages) ? record.stages[s.id] : undefined;
    const three = isNum(st0?.measures?.damage?.resisting);
    const form = verdictForm(s.variant, isObj(st0?.measures?.damage), three, hasHitsSurvived(st0?.measures?.arbiter) ? ARBITER_LABEL_A12 : ARBITER_LABEL);
    if (mine.length === 0) {
      fail('verdict-line', `${where} has no verdict line for the ${label} rung, stage ${s.id}: "${form}" (D-283)`);
      continue;
    }
    if (mine.length > 1) fail('verdict-line', `${where} has ${mine.length} verdict lines for the ${label} rung; one per rung (D-283)`);
    const at = `guide.md:${mine[0].n}`;
    const m = VERDICT_LINE.exec(mine[0].text);
    if (!m) {
      fail('verdict-line', `${at}: the ${label} verdict line isn't in the fixed form "${v3 ? form : form.replace(EHP_PART, '')}" (D-283${v3 ? ', D-294' : ''})`);
      continue;
    }
    // D-353: the survival label. The entering-maps rung's is judgment; the budget and non-budget rungs' is the
    // record's Arbiter verdict, in the template's words. D-459 (amendment 12): a record whose rows carry hits survived
    // gives the deciding row's label in its three forms, read against the floor.
    if (s.variant === 'entering-maps') {
      if (!['solid', 'watch', 'risky'].includes(m[3])) fail('survival-label', `${at}: the ${label} verdict line's label is ${show(m[3])}; the entering-maps rung's label is solid, watch or risky (D-283)`);
    } else if (hasHitsSurvived(st0?.measures?.arbiter)) {
      const want = labelOf(st0.measures.arbiter, floor);
      if (plainTypography(m[3]) !== want) {
        const r = arbiterReading(st0.measures.arbiter, floor);
        const row = r?.row;
        fail('survival-label', `${at}: the ${label} verdict line's label is ${show(m[3])}, but stage ${s.id}'s deciding Arbiter row is ${row ? `the ${typeWords(row.type)} row (ratio ${isNum(row.ratio) ? round2(row.ratio) : '—'}, hits survived ${isNum(row.hitsSurvived) ? pct1(row.hitsSurvived) : '—'}%)` : 'none'}${r?.oneShot ? `, under the ${Math.round(floor * 100)}% floor` : ''}, so its label is ${show(want)} (D-353, D-459)`);
      }
    } else if (plainTypography(m[3]) !== arbiterLabel(st0?.measures?.arbiter)) {
      const verdict = st0?.measures?.arbiter?.verdict;
      fail('survival-label', `${at}: the ${label} verdict line's label is ${show(m[3])}, but stage ${s.id}'s measures.arbiter verdict is ${show(verdict ?? null)}${verdict === 'one-shot' ? `, its worst hit ${show(st0.measures.arbiter.worst?.type)}` : ''}, so its label is ${show(arbiterLabel(st0?.measures?.arbiter))} (D-353)`);
    }
    if (v3 && m[16] === undefined) {
      fail('verdict-line', `${at}: the ${label} verdict line doesn't end with "Effective HP about <n>.", the stage's TotalEHP beside its max hit: "${VERDICT_FORM}" (D-294)`);
    }
    if (Number(m[2]) !== s.level) fail('verdict-line', `${at}: the ${label} verdict line says level ${m[2]}, but stage ${s.id}'s level is ${show(s.level)} (D-283)`);
    const st = isObj(record?.stages) ? record.stages[s.id] : undefined;
    const out = isObj(st?.outputs) ? st.outputs : null;
    if (!out) {
      fail('verdict-line', `${at}: the record holds no outputs for stage ${s.id}, so its ${label} verdict line can't be compared (D-283)`);
      continue;
    }
    // D-353: the reference hits the compiler wrote into the stage's config, filling any the plan omits.
    const written = isObj(st?.configWritten) ? st.configWritten : {};
    const hit = (t) => written[`enemy${t}Damage`];
    const least = (xs) => (xs.every(isNum) ? Math.min(...xs) : undefined);
    const most = (xs) => (xs.every(isNum) ? Math.max(...xs) : undefined);
    const parts = [
      ['fire resistance', m[4], out.FireResist, `${s.id}.FireResist`],
      ['cold resistance', m[5], out.ColdResist, `${s.id}.ColdResist`],
      ['lightning resistance', m[6], out.LightningResist, `${s.id}.LightningResist`],
      ['chaos resistance', m[7], out.ChaosResist, `${s.id}.ChaosResist`],
      ['physical max hit', m[8], out.PhysicalMaximumHitTaken, `${s.id}.PhysicalMaximumHitTaken`],
      ['physical hit', m[9], hit('Physical'), `the hit the compiler wrote, ${s.id}.configWritten.enemyPhysicalDamage`],
      ['elemental or chaos max hit', m[10], least(OTHER_TYPES.map((t) => out[`${t}MaximumHitTaken`])), `the least of ${s.id}'s ${OTHER_TYPES.map((t) => `${t}MaximumHitTaken`).join(', ')}`],
      ['elemental or chaos hit', m[11], most(OTHER_TYPES.map((t) => hit(t))), `the largest of the hits the compiler wrote, ${s.id}.configWritten's ${OTHER_TYPES.map((t) => `enemy${t}Damage`).join(', ')}`],
    ];
    // The DPS is the record's measures.dps (D-353), the main group's figure × its Count (its minion's
    // MinionTotalDPS when it names a minion skill or is a plain summon, else its TotalDPS; D-378, D-397), the
    // figure W1 is told to write, whatever field or ledger figure the D1 gate names (the gate's own recompute
    // reads that). A record from before D-353 has no measures, so its line is read against the gate's figure
    // for the stage's rolledGroup (§5.3), × its Count where the record has a counted copy (D-294, D-340).
    // D-437, D-447 (amendment 11): a record carrying measures.damage gives the line its two figures, the map figure
    // measures.damage.map and the boss figure the ledger's boss_<stage> (its current formula) when the plan estimates
    // one, else measures.damage.boss; a guide written from an older record keeps its one figure, measures.dps (§19).
    // D-454 (amendment 12): a record carrying measures.damage.resisting gives the line its third figure, between the two;
    // a guide written from an older record keeps its two (§22).
    const damage = isObj(st?.measures?.damage) ? st.measures.damage : null;
    if (damage !== null && m[15] === undefined) {
      fail('verdict-line', `${at}: the ${label} verdict line gives one damage figure, but stage ${s.id}'s record measures it against map monsters and against a Pinnacle boss: "${form}" (D-437, D-447)`);
    } else if (damage !== null && three && m[14] === undefined) {
      fail('verdict-line', `${at}: the ${label} verdict line gives two damage figures, but stage ${s.id}'s record measures it against resisting rares too (measures.damage.resisting): "${form}" (D-454)`);
    } else if (damage !== null && !three && m[14] !== undefined) {
      fail('verdict-line', `${at}: the ${label} verdict line gives a figure against resisting rares, but stage ${s.id}'s record has no measures.damage.resisting to compare it with; a guide written from a record before amendment 12 gives two figures (§22)`);
    } else if (damage === null && m[15] !== undefined) {
      fail('verdict-line', `${at}: the ${label} verdict line gives a boss figure, but stage ${s.id}'s record has no measures.damage to compare it with; a guide written from a record before amendment 11 gives one figure, "<Skill> about <n> DPS." (§19)`);
    } else if (damage !== null) {
      const estimated = isObj(plan) && list(plan.ledger).some((e) => e.id === `boss_${s.id}`);
      parts.push(['damage against map monsters', m[13], damage.map, `${s.id}.measures.damage.map`]);
      if (three) parts.push(['damage against resisting rares', m[14], damage.resisting, `${s.id}.measures.damage.resisting`]);
      parts.push(['damage against a Pinnacle boss', m[15], estimated ? ledgerNow[`boss_${s.id}`]?.value : damage.boss, estimated ? `the ledger's boss_${s.id}, its current formula over the record (D-447)` : `${s.id}.measures.damage.boss`]);
    } else if (isObj(st?.measures)) {
      parts.push(['DPS', m[13], st.measures.dps, `${s.id}.measures.dps (the main group's figure × its Count)`]);
    } else {
      const fig = list(list(d1rep?.basis?.rolledSkill).find((b) => b.stage === s.id)?.figures).find((f) => f.group === s.skills?.rolledGroup)?.figure;
      const lg = /^ledger:(\w+)$/.exec(String(fig ?? ''));
      const read = lg ? { value: ledgerNow[lg[1]]?.value, counted: false } : figureOf(st, fig);
      const named = read.counted ? `the named damage source's figure × its Count ${read.count}, ${s.id}.countedSkillOutputs.${fig}` : `the named damage source's figure ${s.id}.${fig}`;
      if (fig === undefined) fail('verdict-line', `${at}: the D1 gate's verdict names no figure for stage ${s.id}'s named damage source, so the ${label} verdict line's DPS can't be compared (D-283)`);
      else parts.push(['DPS', m[13], read.value, named]);
    }
    if (m[16] !== undefined) parts.push(['Effective HP', m[16], out.TotalEHP, `${s.id}.TotalEHP`]);
    for (const [part, written, value, from] of parts) {
      if (!isNum(value)) fail('verdict-line', `${at}: the ${label} verdict line's ${part} can't be compared: the record has no value for ${from} (D-283)`);
      else if (!matchesWritten(written, value)) {
        fail('verdict-line', `${at}: the ${label} verdict line says ${part} ${written}, but ${from} is ${value}, which doesn't round to it at that number's last significant digit (D-283)`);
      }
    }
  }
}

/** D-452 (amendment 12, Appendix A): the guide's tree-change line, `Respec: refund <n> points and allocate <m>; respeccing costs gold.` */
const TREE_CHANGE = /\bRespec: refund ([\d,]+) points? and allocate ([\d,]+)\b/;

/**
 * D-452 (Appendix A): on each stage whose record carries `treeChange {from, refunded, added}` (a schema-8 plan's stage
 * with a stage before it), its guide section (a rung's `Endgame: …` H2, a campaign stage's Leveling H3 by its loadout
 * name) has one tree-change line when `refunded` is above 0, its counts the record's, and none when it is 0; a stage
 * without `treeChange` has none. The counts only: no gold figure (A-32).
 */
function checkTreeChangeLines(guide, planStages, record, fail) {
  const leveling = h2Named(guide, 'Leveling');
  const h3s = leveling ? h3sUnder(guide, leveling) : [];
  for (const s of planStages) {
    const rec = isObj(record?.stages) ? record.stages[s.id] : undefined;
    const heading = typeof s.variant === 'string' ? h2Named(guide, VARIANT_H2[s.variant] ?? '') : h3s.find((h) => h.title === (rec?.loadoutName ?? s.loadoutName)) ?? null;
    if (!heading) continue;
    const { start, end } = guide.sectionOf(heading);
    const found = guide.lines.slice(start + 1, end).map((l, k) => ({ m: TREE_CHANGE.exec(l), n: start + k + 2 })).filter((x) => x.m);
    const where = `guide.md's "${heading.title}"`;
    const tc = rec?.treeChange;
    if (!isObj(tc) || !isInt(tc.refunded) || !isInt(tc.added)) {
      for (const f of found) fail('tree-change', `guide.md:${f.n}: ${where} has a tree-change line, but the record's stage ${s.id} has no treeChange to state; the line goes on a schema-8 stage with a stage before it whose treeChange.refunded is above 0 (D-452)`);
      continue;
    }
    if (tc.refunded === 0) {
      for (const f of found) fail('tree-change', `guide.md:${f.n}: ${where} has a tree-change line, but stage ${s.id}'s treeChange refunds no point (refunded 0, added ${tc.added}); the line goes only where a point is refunded (D-452, Appendix A)`);
      continue;
    }
    const line = `Respec: refund ${tc.refunded} points and allocate ${tc.added}; respeccing costs gold.`;
    if (found.length === 0) fail('tree-change', `${where} has no tree-change line for stage ${s.id}, whose treeChange from ${show(tc.from)} refunds ${tc.refunded} points and allocates ${tc.added}: "${line}" (D-452, Appendix A)`);
    else if (found.length > 1) fail('tree-change', `${where} has ${found.length} tree-change lines for stage ${s.id}; one (D-452)`);
    for (const f of found) {
      const [refunded, added] = [Number(f.m[1].replace(/,/g, '')), Number(f.m[2].replace(/,/g, ''))];
      if (refunded !== tc.refunded || added !== tc.added) fail('tree-change', `guide.md:${f.n}: ${where}'s tree-change line refunds ${refunded} points and allocates ${added}, but stage ${s.id}'s treeChange from ${show(tc.from)} is refunded ${tc.refunded}, added ${tc.added}: "${line}" (D-452)`);
    }
  }
}

/** The non-empty lines of a section, trimmed, with their 1-based line numbers. */
function sectionLines(md, heading) {
  const { start, end } = md.sectionOf(heading);
  return md.lines.slice(start + 1, end).map((raw, k) => ({ raw: raw.trim(), n: start + k + 2 })).filter((l) => l.raw !== '');
}
/** A writer's dash for the templates' `—`: a hyphen, the Unicode hyphens and dashes (U+2010…U+2015) or a minus. */
const isDash = (c) => /^[-\u2010-\u2015\u2212]$/.test(c);
/** A label as the template words it, whatever the writer's typography: curly apostrophes plain, dashes a hyphen. */
const plainTypography = (s) => String(s).replace(/[\u2018\u2019\u02BC\u2032]/g, "'").replace(/[\u2010-\u2015\u2212]/g, '-');

/**
 * D-276, D-278, D-283: Known issues by sentence. The guide's H3 `Known issues`, the last part of `What PoB can't
 * show`, lists one plain sentence per finding (`- <sentence>`), with no id; audit.md's `Known issues` table holds
 * each finding's row `| <id> | <lens or gate> | <stage> | <the sentence the guide prints> |`: an open V4 finding
 * `| <id> | V4 | — | <its reader> |` (D-352); an accepted gate finding by its code, gate and plan stage (W1
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
    rows.push({ id: cell(cells[0]), from: cell(cells[1]), stage: cells[2] === '' || isDash(cells[2]) ? null : cell(cells[2]), sentence: cells[3], n: l.n });
  }
  const used = new Set();
  const sentences = [];
  const listed = (sentence) => items.some((l) => collapse(l.text) === collapse(sentence));
  for (const f of open) {
    const row = rows.find((r) => r.id === f.id);
    const reader = typeof f.reader === 'string' && f.reader.trim() !== '' ? f.reader.trim() : null;
    if (!row) fail('known-issues', `V4 finding ${show(f.id)} (${f.issue ?? 'no issue text'}) is open in ${f.file}, the last report, but audit.md's ${KNOWN_ISSUES} has no row "| ${f.id} | V4 | — | <its reader sentence> |" (D-276, D-278, D-352)`);
    else {
      used.add(row);
      if (row.from !== 'V4') fail('known-issues', `audit.md:${row.n}: the ${KNOWN_ISSUES} row for ${show(f.id)} names ${show(row.from)}; an open V4 finding's row names V4 (§7.8, D-352)`);
      if (reader && collapse(row.sentence) !== collapse(reader)) fail('known-issues', `audit.md:${row.n}: the ${KNOWN_ISSUES} row for ${show(f.id)} gives ${show(row.sentence)}, not the finding's reader sentence ${show(reader)} (D-265, §7.8)`);
    }
    if (reader) {
      sentences.push(collapse(reader));
      if (!listed(reader)) fail('known-issues', `V4 finding ${show(f.id)} (${f.issue ?? 'no issue text'}) is open in ${f.file}, the last report, but guide.md's ${KNOWN_ISSUES} doesn't list its reader sentence, word for word, as "- ${reader}" (D-265, D-276)`);
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
 * Schema 3's gate answers (D-287, D-288, D-323, D-362): the answer recorded at each gate, and the test-config
 * answer (`answers.brainstorm`, `answers.verification`, `answers.design`, `answers.final`, `answers.escalation`,
 * `answers.unsavedBuild`) a pre-supplied entry's `rule` records exactly as written.
 */
const IDS = (n) => `${CARD_ID}(?:,${CARD_ID}){0,${n - 1}}`;
/** A brainstorm `pick:` or a verification `verify:` with no id picks only the cards its `newCards` makes (D-391). */
const GATE_ANSWERS = {
  brainstorm: new RegExp(`^(?:pick:(?:${IDS(3)})?|more|stop)$`),
  verification: new RegExp(`^(?:pick:${CARD_ID}|verify:(?:${IDS(3)})?|more|stop)$`),
  design: /^(?:accept|revise:.+|verification|stop)$/s,
  final: /^.+$/s,
  'unsaved-build': /^(?:proceed|stop)$/,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
const GATE_RULES = {
  brainstorm: new RegExp(`^(?:pick:(?:${IDS(3)})?|first-n:[1-3]|more|stop)$`),
  verification: new RegExp(`^(?:first-viable|pick:${CARD_ID}|verify:(?:${IDS(3)})?|more|stop)$`),
  design: /^(?:accept|revise:.+|verification|stop)$/s,
  final: /^(?:accept|not-accept|revise:.+)$/s,
  'unsaved-build': /^(?:proceed|stop)$/,
  escalation: /^(?:accept|retry:.+|verification|stop)$/s,
};
/**
 * Schema 4's answers (amendment 9; D-411, D-415): the verification gate finalizes 1–3 cards and, after a resume, takes
 * `guide:<id>`, `campaign:<id>` and `design:<id>`; the design gate adds `accept:file`; the final gate's answers are
 * `accept`, `accept:verification`, `campaign`, `revise:<text>` and `decline:<note>`, its `stop` the default only. A
 * test config's final `not-accept` resolves to a decline.
 */
const GATE_ANSWERS4 = {
  ...GATE_ANSWERS,
  verification: new RegExp(`^(?:pick:${IDS(3)}|verify:(?:${IDS(3)})?|(?:guide|campaign|design):${CARD_ID}|more|stop)$`),
  design: /^(?:accept|accept:file|revise:.+|verification|stop)$/s,
  final: /^(?:accept|accept:verification|campaign|revise:.+|decline:.+|stop)$/s,
};
const GATE_RULES4 = {
  ...GATE_RULES,
  verification: new RegExp(`^(?:first-viable|pick:${IDS(3)}|verify:(?:${IDS(3)})?|more|stop)$`),
  design: /^(?:accept|accept:file|revise:.+|verification|stop)$/s,
  final: /^(?:accept|accept:verification|campaign|not-accept|revise:.+|decline:.+)$/s,
};
/** D-415: a resume's own answers at the verification gate, each naming a build. */
const RESUME_ANSWER = new RegExp(`^(guide|campaign|design):(${CARD_ID})$`);
/** What each gate's answers look like, for the messages. */
const ANSWER_FORMS = {
  brainstorm: 'pick:<id>[,<id>…] (1–3 cards, new cards included), more or stop',
  verification: 'pick:<id> (finalize one card), verify:<id>[,<id>…] (1–3 cards, new cards included), more or stop',
  design: 'accept, revise:<text>, verification or stop (D-362)',
  final: 'accept, revise:<text> or the user\'s note',
  'unsaved-build': 'proceed or stop',
  escalation: 'accept, retry:<guidance>, verification or stop',
};
const ANSWER_FORMS4 = {
  ...ANSWER_FORMS,
  verification: 'pick:<id>[,<id>…] (finalize 1–3 cards), verify:<id>[,<id>…] (1–3 cards, new cards included), more, stop, or after a resume guide:<id>, campaign:<id> or design:<id> (D-411, D-415)',
  design: 'accept, accept:file, revise:<text>, verification or stop (D-362, D-411)',
  final: 'accept, accept:verification, campaign, revise:<text> or decline:<note> (D-411)',
};

/** The card ids a `pick:` or `verify:` answer names; none for any other answer. */
const idsOf = (answer) => (/^(?:pick|verify):(.*)$/s.exec(String(answer))?.[1] ?? '').split(',').filter((x) => x !== '');
/** A schema-3 checkpoint's fields (run-log.md): amendment 7 adds questions, changes, newCards and note (D-389, D-391). */
const CHECKPOINT_FIELDS = ['checkpoint', 'visit', 'answer', 'answeredBy', 'rule', 'questions', 'changes', 'newCards', 'note'];
/** The most picks and new cards one answer verifies (D-287, D-391). */
const PICK_CAP = 3;

/**
 * Amendment 7's parts of a gate's answer (D-389, D-391): `questions`, a whole number on a gate's or an escalation's
 * answer; `changes`, keyed by the cards a brainstorm `pick:`, a verification `pick:` or `verify:` names; `newCards`,
 * `[{id: "r<k>-g-<n>", name, from, words}]` with a brainstorm `pick:` or a verification `verify:`, the picks and the
 * new cards 1–3 together; `note` only with `more`.
 */
function checkGateChoice(c, at, ids, bad, schema = 3) {
  const gate = c.checkpoint;
  const a = String(c.answer);
  // D-412: schema 4's design and final checkpoints name their build, `concept`; no other checkpoint does.
  const fields = schema === 4 ? [...CHECKPOINT_FIELDS, 'concept'] : CHECKPOINT_FIELDS;
  for (const k of Object.keys(c)) if (!fields.includes(k)) bad(at, `has "${k}", which isn't a field of a checkpoint (${fields.join(', ')})`);
  if (schema === 4) {
    const per = ['design', 'final'].includes(gate);
    if (per && !new RegExp(`^${CARD_ID}$`).test(String(c.concept))) bad(at, `is a ${gate} checkpoint with concept ${show(c.concept)}; in schema 4 a ${gate} checkpoint names its build, the card id (D-412)`);
    else if (!per && 'concept' in c) bad(at, `has concept, which only a design or final checkpoint carries (D-412)`);
    if (gate === 'final' && a === 'stop' && c.answeredBy !== 'default') bad(at, "answers stop, which at the final gate is the default only; a user who declines answers decline:<note> (D-411)");
  }
  if ('questions' in c) {
    if (!DISPLAYED.includes(gate)) bad(at, "has questions; only a gate's or an escalation's answer counts the user's questions, and the unsaved-build question is a fixed one (D-389)");
    else if (!isInt(c.questions)) bad(at, `questions is ${show(c.questions)}; it counts the questions the user asked at the visit, a whole number from 0 (D-389)`);
  }
  const picking = (gate === 'brainstorm' && a.startsWith('pick:')) || (gate === 'verification' && /^(?:pick|verify):/.test(a));
  const making = (gate === 'brainstorm' && a.startsWith('pick:')) || (gate === 'verification' && a.startsWith('verify:'));
  if ('changes' in c) {
    if (!picking) bad(at, `has changes, but answers ${show(a)}; a revision rides on picked cards, a brainstorm pick:<ids> or a verification pick:<id> or verify:<ids> (D-391)`);
    else if (!isObj(c.changes) || Object.keys(c.changes).length === 0 || !Object.values(c.changes).every((v) => typeof v === 'string' && v.trim() !== '')) bad(at, `changes is ${show(c.changes)}; it is {"<card id>": "<the user's words>", …} (D-391)`);
    else for (const id of Object.keys(c.changes)) if (!ids.includes(id)) bad(at, `changes names ${id}, which ${show(a)} doesn't pick; a revision rides on a picked card (D-391)`);
  }
  const made = Array.isArray(c.newCards) ? c.newCards.length : 0;
  if ('newCards' in c) {
    if (!making) bad(at, `has newCards, but answers ${show(a)}; a new card goes with a brainstorm pick: or a verification verify: (D-391)`);
    else if (made === 0) bad(at, 'has newCards with no card in it');
    c.newCards?.forEach?.((n, k) => {
      // D-432: `from` names cards and composites by id, and pieces by key, a Pieces row's or an Ideas line's.
      const ok = isObj(n) && GATE_CARD.test(String(n.id)) && typeof n.name === 'string' && n.name.trim() !== '' && typeof n.words === 'string' && n.words.trim() !== ''
        && Array.isArray(n.from) && n.from.length > 0 && n.from.every((id) => new RegExp(`^(?:${CARD_ID}|${PIECE_KEY})$`).test(String(id))) && Object.keys(n).every((x) => ['id', 'name', 'from', 'words'].includes(x));
      if (!ok) bad(`${at}.newCards[${k}]`, `is ${show(n)}; a new card is {"id": "r<k>-g-<n>", "name", "from": ["<card id or piece key>", …], "words"} (D-391, D-432)`);
      else if (ids.includes(n.id)) bad(`${at}.newCards[${k}]`, `makes ${n.id}, which the answer also picks`);
    });
  }
  if (making && ids.length === 0 && made === 0) bad(at, `answers ${show(a)}, which picks no card and makes none; a pick names 1–${PICK_CAP} cards, new cards included (D-391)`);
  if (picking && ids.length + made > PICK_CAP) bad(at, `answers ${show(a)} with ${made} new card(s): ${ids.length + made} cards, over ${PICK_CAP}; a pick verifies 1–${PICK_CAP} cards, new cards included (D-391)`);
  if ('note' in c) {
    if (a !== 'more' || !['brainstorm', 'verification'].includes(gate)) bad(at, `has a note, but answers ${show(a)}; the note goes with more, the brainstorm-more answer (D-391)`);
    else if (typeof c.note !== 'string' || c.note.trim() === '') bad(at, "note is the user's note, a non-empty text");
  }
}

/** A schema-3 checkpoint entry's answer and rule (D-288, D-323; checkpoints.md's pre-supplied answers). */
function checkGateAnswer(c, at, bad, schema = 3) {
  const gate = c.checkpoint;
  const [answers, forms, rules] = schema === 4 ? [GATE_ANSWERS4, ANSWER_FORMS4, GATE_RULES4] : [GATE_ANSWERS, ANSWER_FORMS, GATE_RULES];
  if (!Object.prototype.hasOwnProperty.call(answers, gate) || typeof c.answer !== 'string') return;
  if (gate === 'escalation' && c.answer === 'checkpoint-1') {
    bad(at, 'answers "checkpoint-1", which schema 3 retires: going back to the verification gate is "verification" (D-289)');
  } else if (!answers[gate].test(c.answer)) bad(at, `answers ${show(c.answer)}; the ${gate} ${['unsaved-build', 'escalation'].includes(gate) ? 'question' : 'gate'}'s answer is ${forms[gate]} (D-287, D-289${schema === 4 ? ', D-411' : ''})`);
  const ids = idsOf(c.answer);
  if (new Set(ids).size !== ids.length) bad(at, `answers ${show(c.answer)}, which names a card twice`);
  checkGateChoice(c, at, ids, bad, schema);
  if (typeof c.rule !== 'string' || c.rule.trim() === '') return;
  // D-323: the test config's keys and answers are schema 3's; checkpoint1, checkpoint2 and checkpoint-1 are retired.
  if (/checkpoint-?[12]/.test(c.rule)) bad(at, `has rule ${show(c.rule)}, which names a retired test-config key or answer (checkpoint1, checkpoint2, checkpoint-1); schema 3's are answers.brainstorm, answers.verification, answers.design, answers.final and the escalation answer "verification" (D-323, D-362)`);
  if (c.answeredBy === 'default') {
    if (c.answer !== 'stop') bad(at, `is answered by default ${show(c.answer)}; with no test-config answer left, the default is "stop" (§11.2)`);
    return;
  }
  if (c.answeredBy !== 'pre-supplied') return;
  if (!rules[gate].test(c.rule)) {
    bad(at, `has rule ${show(c.rule)}, which isn't an answers.${gate === 'unsaved-build' ? 'unsavedBuild' : gate} value of the test config (checkpoints.md)`);
    return;
  }
  // The answer is the rule as written, or what first-n:<n> and first-viable resolved to. A verification pick of
  // a card the gate can't finalize is illegal, so the run stops (D-303, D-342): the flow check holds that card.
  const n = /^first-n:([1-3])$/.exec(c.rule)?.[1];
  const resolved = n !== undefined ? c.answer === 'stop' || (/^pick:/.test(c.answer) && ids.length <= Number(n))
    : c.rule === 'first-viable' ? c.answer === 'stop' || new RegExp(`^pick:${CARD_ID}$`).test(c.answer)
      : c.answer === c.rule || (gate === 'verification' && /^pick:/.test(c.rule) && c.answer === 'stop') || (schema === 4 && gate === 'final' && c.rule === 'not-accept' && /^decline:./s.test(c.answer));
  if (!resolved) bad(at, `answers ${show(c.answer)}, but its rule ${show(c.rule)} resolves to ${n !== undefined ? `pick: with at most ${n} card(s), or stop` : c.rule === 'first-viable' ? 'pick:<one card>, or stop' : show(c.rule)} (checkpoints.md)`);
}

/**
 * Schema 4's own fields (amendment 9; D-412, D-415): no run-level `roll` or `outputs`; `noNinja` true or false (null in
 * a migrated run), the pin's commit and the digest's file name (or null); the run-wide `dossier`; `builds[]`, one per
 * finalized card in finalize order, `{id, roll, name?, status, folder, guide, pobFile}` (`name` only when given, D-435), a migrated run's build
 * alone in "."; and
 * `resumes[]`, `{date, pinCommit, digest, noNinja, lengths}`, the lengths of the four lists at each resume, in order.
 */
function checkSchema4Fields(log, bad) {
  for (const k of ['roll', 'outputs']) if (k in log) bad(k, `is schema 3's; schema 4 records each build's roll and PoB file in builds[], and the dossier run-wide (D-412)`);
  // D-415: a migrated log's three nulls (its run predates them); a log init wrote holds true or false.
  const migrated = list(log.builds).some((b) => b.folder === '.') || (log.pinCommit === null && log.digest === null);
  if ('noNinja' in log && !(typeof log.noNinja === 'boolean' || (migrated && log.noNinja === null))) bad('noNinja', `is ${show(log.noNinja)}; init records true or false (--no-ninja), null only in a migrated run (D-412, D-415)`);
  for (const k of ['pinCommit', 'digest']) if (k in log && log[k] !== null && (typeof log[k] !== 'string' || log[k].trim() === '')) bad(k, `is ${show(log[k])}; the ${k === 'pinCommit' ? "pin's commit, read from pob-pin.json" : "newest league digest's file name"}, or null (D-412)`);
  if ('dossier' in log && log.dossier !== null && (typeof log.dossier !== 'string' || log.dossier.trim() === '')) bad('dossier', `is ${show(log.dossier)}; the dossier's path in the run folder, or null (D-412)`);
  if ('builds' in log && !Array.isArray(log.builds)) bad('builds', 'is a list, one build per finalized card (D-412)');
  const ids = new Set();
  // D-466 (amendment 13, Appendix A): a log at 13 may carry each build's draftFile after its pobFile; an older log has none.
  const drafts = revisionOf(log) >= A13;
  list(log.builds).forEach((b, i) => {
    const at = `builds[${i}]`;
    const keys = Object.keys(b);
    const forms = [BUILD_FIELDS, BUILD_FIELDS_NAMED, ...(drafts ? [[...BUILD_FIELDS, 'draftFile'], [...BUILD_FIELDS_NAMED, 'draftFile']] : [])];
    if (!forms.some((f) => show(keys) === show(f))) bad(at, `has the fields ${keys.join(', ')}; a build is {${BUILD_FIELDS.join(', ')}}, with name after roll when its finalize gave it one (D-412, D-435)${drafts ? ', and draftFile after pobFile in a log at 13 (D-466)' : ''}`);
    if ('name' in b && (typeof b.name !== 'string' || b.name.trim() === '')) bad(at, `name is ${show(b.name)}; the build's name, a non-empty text (D-435)`);
    if ('draftFile' in b && b.draftFile !== null && (typeof b.draftFile !== 'string' || b.draftFile.trim() === '')) bad(at, `draftFile is ${show(b.draftFile)}; the latest draft's path, or null (D-466)`);
    if (!new RegExp(`^${CARD_ID}$`).test(String(b.id))) bad(at, `id ${show(b.id)} isn't a card id r<round>-<letter>-<n> (D-412)`);
    else if (ids.has(b.id)) bad(at, `${b.id} has a second build; a card with a build in the run isn't finalized again (D-411)`);
    ids.add(b.id);
    if (!(isObj(b.roll) && ['className', 'ascendancy', 'skill'].every((k) => typeof b.roll[k] === 'string' && b.roll[k] !== ''))) bad(at, `roll is ${show(b.roll)}; it is the card's identity {className, ascendancy, skill} (D-286, D-412)`);
    else if (isObj(log.brief)) {
      for (const k of ['ascendancy', 'skill']) {
        if (typeof log.brief[k] === 'string' && norm(b.roll[k]) !== norm(log.brief[k])) bad(at, `roll names ${k} ${show(b.roll[k])}, but the brief fixes ${show(log.brief[k])}; no card contradicting the brief's ${k} is dealt (R1a-assemble, D-285)`);
      }
    }
    if (!BUILD_STATUSES.includes(b.status)) bad(at, `status is ${show(b.status)}; one of ${BUILD_STATUSES.join(', ')} (D-412)`);
    if (b.folder !== `builds/${b.id}` && !(b.folder === '.' && i === 0)) bad(at, `folder is ${show(b.folder)}; a build's folder is builds/<id>, or "." for a migrated run's build, builds[0] (D-412, D-415)`);
    if (![null, 'endgame', 'full'].includes(b.guide)) bad(at, `guide is ${show(b.guide)}; null, endgame or full, as the plan decides (D-414)`);
    if (b.pobFile !== null && (typeof b.pobFile !== 'string' || b.pobFile.trim() === '')) bad(at, `pobFile is ${show(b.pobFile)}; the final compile's PoB file path, or null (D-412)`);
  });
  // §19 (amendment 11), amendment 12's §22 and Appendix A: the skill revision init writes, and where a resume stamped
  // each revision on an older log. A log at 11 (amendment 11's) keeps its flat boundary; a log at 12 has one boundary per
  // revision a resume stamped, `{"11": {…}, "12": {…}}`, in order, each a resume's lengths.
  if ('skillRevision' in log && !REVISIONS.includes(log.skillRevision)) bad('skillRevision', `is ${show(log.skillRevision)}; ${REVISIONS.join(' or ')}: ${SKILL_REVISION}, which init writes and a resume stamps on an older log, or ${A11}, a log written under amendment 11's rules (§19, amendment 12 §22)`);
  if ('skillRevisionFrom' in log) {
    const f = log.skillRevisionFrom;
    const lengthsOk = (x) => isObj(x) && show(Object.keys(x)) === show(RESUME_LISTS) && RESUME_LISTS.every((k) => isInt(x[k]));
    const resumed = (x) => list(log.resumes).some((r) => isObj(r.lengths) && RESUME_LISTS.every((k) => r.lengths[k] === x[k]));
    if (!REVISIONS.includes(log.skillRevision)) bad('skillRevisionFrom', `is set, but skillRevision isn't ${REVISIONS.join(' or ')}; a resume stamps both together (§19)`);
    else if (log.skillRevision === A11) {
      // Amendment 11's form: the lists' lengths where the resume stamped revision 11.
      if (!lengthsOk(f)) bad('skillRevisionFrom', `is ${show(f)}; on a log at ${A11} it is {${RESUME_LISTS.join(', ')}}, the lists' lengths where the resume stamped the skill revision (§19)`);
      else if (!resumed(f)) bad('skillRevisionFrom', `is ${show(f)}, but no resumes[] entry recorded those lengths; a resume stamps the skill revision where it happens (§19)`);
    } else if (!isObj(f) || Object.keys(f).length === 0 || !Object.keys(f).every((k) => REVISIONS.some((r) => String(r) === k && r <= log.skillRevision))) {
      bad('skillRevisionFrom', `is ${show(f)}; on a log at ${log.skillRevision} it holds one boundary per revision a resume stamped, {${REVISIONS.filter((r) => r <= log.skillRevision).map((r) => `"${r}": {${RESUME_LISTS.join(', ')}}`).join(', ')}}, each for a revision up to the log's (Appendix A)`);
    } else {
      let prev = null;
      for (const r of REVISIONS.filter((x) => String(x) in f)) {
        const x = f[String(r)];
        if (!lengthsOk(x)) bad('skillRevisionFrom', `"${r}" is ${show(x)}; it is {${RESUME_LISTS.join(', ')}}, the lists' lengths where a resume stamped revision ${r} (Appendix A)`);
        else if (!resumed(x)) bad('skillRevisionFrom', `"${r}" is ${show(x)}, but no resumes[] entry recorded those lengths; a resume stamps each revision where it happens (Appendix A)`);
        else if (prev !== null && RESUME_LISTS.some((k) => x[k] < prev[k])) bad('skillRevisionFrom', `"${r}" is ${show(x)}, before the boundary of an earlier revision; a later revision is stamped at the same resume or after it (Appendix A)`);
        if (lengthsOk(x)) prev = x;
      }
      // A log stamped from below 11 gains 11's boundary with 12's; one that holds 11's boundary with no 12's isn't at 12.
      if (!(String(log.skillRevision) in f)) bad('skillRevisionFrom', `is ${show(f)}, with no boundary for ${log.skillRevision}, the log's revision; a resume that stamps ${log.skillRevision} writes its boundary (Appendix A)`);
    }
  }
  // D-444: the pricing stops and the gates' retry answers, `{stops: [{at, step, outcome}], retries: [{checkpoint, answer, at}]}`.
  if ('pricing' in log) {
    const p = log.pricing;
    if (!isObj(p) || show(Object.keys(p).sort()) !== show(['retries', 'stops']) || !Array.isArray(p.stops) || !Array.isArray(p.retries)) bad('pricing', `is ${show(p)}; it is {stops: [{at, step, outcome}], retries: [{checkpoint, answer, at}]} (D-444)`);
    else {
      p.stops.forEach((x, k) => {
        if (!isObj(x) || show(Object.keys(x)) !== show(['at', 'step', 'outcome']) || !isInt(x.at) || typeof x.step !== 'string' || !STOP_OUTCOMES.includes(x.outcome)) bad(`pricing.stops[${k}]`, `is ${show(x)}; a stop is {at, step, outcome}: the stages[] index of the step that hit it, its stage, and rate_limited, locked_out or pace (D-444, D-474)`);
      });
      p.retries.forEach((x, k) => {
        if (!isObj(x) || show(Object.keys(x)) !== show(['checkpoint', 'answer', 'at']) || !DISPLAYED.includes(x.checkpoint) || !RETRY_ANSWERS.includes(x.answer) || !isInt(x.at)) bad(`pricing.retries[${k}]`, `is ${show(x)}; a retry is {checkpoint, answer, at}: the gate that asked, ${RETRY_ANSWERS.join(' or ')}, and the stages[] length when it answered (D-444)`);
      });
    }
  }
  if ('resumes' in log && !Array.isArray(log.resumes)) bad('resumes', 'is a list, one entry per resume (D-415)');
  let before = Object.fromEntries(RESUME_LISTS.map((k) => [k, 0]));
  list(log.resumes).forEach((r, i) => {
    const at = `resumes[${i}]`;
    const keys = Object.keys(r);
    if (show(keys) !== show(RESUME_FIELDS)) bad(at, `has the fields ${keys.join(', ')}; a resume is {${RESUME_FIELDS.join(', ')}} (D-415)`);
    if (typeof r.date !== 'string' || !ISO_DATE.test(r.date)) bad(at, `date is ${show(r.date)}; YYYY-MM-DD`);
    if (typeof r.noNinja !== 'boolean') bad(at, `noNinja is ${show(r.noNinja)}; the session's --no-ninja, true or false (D-415)`);
    for (const k of ['pinCommit', 'digest']) if (r[k] !== null && (typeof r[k] !== 'string' || r[k].trim() === '')) bad(at, `${k} is ${show(r[k])}; text or null (D-415)`);
    const l = isObj(r.lengths) ? r.lengths : null;
    if (!l || show(Object.keys(l)) !== show(RESUME_LISTS) || !RESUME_LISTS.every((k) => isInt(l[k]))) {
      bad(at, `lengths is ${show(r.lengths)}; it is {${RESUME_LISTS.join(', ')}}, each list's length at the resume, so the entries after it can be placed (D-415)`);
      return;
    }
    for (const k of RESUME_LISTS) {
      const len = Array.isArray(log[k]) ? log[k].length : 0;
      if (l[k] > len || l[k] < before[k]) bad(at, `lengths.${k} is ${l[k]}; it lies between the last resume's ${before[k]} and the log's ${len} ${k} entries: a resume is recorded when it happens (D-415)`);
    }
    before = l;
  });
}

function checkRunLog(log, fail, schema, caps = { probeCap: () => PROBE_CAP, capWords: () => `a card has at most ${PROBE_CAP} (D-292)` }) {
  const v3 = schema !== 2;
  const v4 = schema === 4;
  for (const k of RUN_LOG_FIELDS[v4 ? 4 : v3 ? 3 : 2]) if (!(k in log)) fail('run-log', `run-log.json has no ${k} (§6${v4 ? ', D-412' : ''})`);
  const bad = (field, why) => fail('run-log', `run-log.json ${field}: ${why}`);
  if ('schemaVersion' in log && !SCHEMA_VERSIONS.includes(log.schemaVersion)) {
    bad('schemaVersion', `is ${show(log.schemaVersion)}; it is 3, or 2 for a run recorded before amendment 3 (D-289, D-326), and 4 from amendment 9 on (D-412)`);
  }
  const roll = log.roll;
  if (v4) {
    if ('brief' in log) checkBrief(log.brief, bad);
    if ('slug' in log && isObj(log.brief) && log.slug !== slugOfBrief(log.brief)) {
      bad('slug', `is ${show(log.slug)}; the brief's slug is "${slugOfBrief(log.brief)}": the slug comes from the brief, and the cards finalized later go in builds[], not in the folder name (§2, D-285, D-412)`);
    }
    checkSchema4Fields(log, bad);
  } else if (!v3) {
    // D-326: the parsed brief is schema 3's (C-51, D-289); a schema-2 run's roll is set from the start.
    if ('brief' in log) bad('brief', "is schema 3's parsed brief (C-51, D-289); a schema-2 log has none: its roll is set from the start, and its slug comes from the roll (D-326)");
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
    // D-326: a probe count (D-338), a short round's reason (D-339) and R1a-assemble (D-287) are schema 3's.
    if (!v3) for (const [k, why] of [['probes', 'D-338'], ['shortReason', 'D-339'], ['tried', 'D-408']]) if (k in s) bad(at, `has ${k}, which schema 3 added (${why}); a schema-2 log has none (D-326)`);
    const outcomes = STAGE_OUTCOMES[v4 ? 4 : v3 ? 3 : 2];
    const known = Object.keys(outcomes).filter((x) => v3 || x !== 'R1a-assemble');
    if (!known.includes(s.stage)) {
      const why = !v3 && s.stage === 'R1a-assemble' ? "; R1a-assemble is schema 3's (D-287), and a schema-2 log has none (D-326)"
        : v3 && s.stage === 'D1' ? '; D1 is two steps, D1-build then D1-finish (D-356)'
          : /^V4-(ledger|sources|prose)/.test(String(s.stage)) ? '; V4 is one pass with no lenses, V4 or V4-recheck, each entry one report reports/V4-<n>.md (D-352)'
            : !v3 && ['D1-build', 'D1-finish'].includes(s.stage) ? "; a schema-2 log's D1 is one step (D-326)"
              : !v4 && ['D1-tree', 'F1', 'V4-campaign'].includes(s.stage) ? `; ${s.stage} is schema 4's (amendment 9, D-412)`
                : !v4 && s.stage === 'R1a-synthesize' ? "; R1a-synthesize is schema 4's (amendment 10, D-429)" : '';
      return bad(at, `stage ${show(s.stage)} isn't one of ${known.join(', ')}${why}`);
    }
    // D-421: a refused call is schema 4's outcome; in schema 3 the permission system's refusal had no entry of its own.
    if (!v4 && s.outcome === REFUSED) return bad(at, `outcome "refused" is schema 4's (D-421); a schema-${schema ?? 3} log has none`);
    if (ROUND_STAGES.includes(s.stage) ? s.concept !== undefined && s.concept !== null : !ID.test(s.concept ?? '')) {
      bad(at, ROUND_STAGES.includes(s.stage) ? `a ${s.stage} entry concerns no one ${v3 ? 'card' : 'concept'}` : `a ${s.stage} entry names its ${v3 ? 'card' : 'concept'}, ${idForm(schema)}`);
    }
    // D-339: a short brainstorm round's reason, on its R1a-assemble entry, or its R1a-synthesize entry (D-429).
    if (v3 && 'shortReason' in s && (!ASSEMBLY_STAGES.includes(s.stage) || typeof s.shortReason !== 'string' || s.shortReason.trim() === '')) {
      bad(at, `has shortReason ${show(s.shortReason)}; only an R1a-assemble or R1a-synthesize entry carries one, the reason its return gave for a short round (D-339, D-429)`);
    }
    // D-408: a rival that found no faster structure (`none-found`) logs what it tried, and only it.
    const triedOk = typeof s.tried === 'string' && s.tried.trim() !== '';
    if (v3 && (s.stage === 'RV' && s.outcome === 'none-found' ? !triedOk : 'tried' in s)) {
      bad(at, `${'tried' in s ? `has tried ${show(s.tried)}` : 'has no tried'}; an RV entry whose outcome is none-found carries tried, what the rival tried, a non-empty text, and no other entry does (D-408)`);
    }
    // D-338: each R1b attempt's probe count, from its return's "probes <n>", so D-292's cap can be audited.
    if (v3 && 'probes' in s && s.stage !== 'R1b') bad(at, `has probes, but only R1b writes probe variants (D-338)`);
    if (v3 && s.stage === 'R1b' && (s.outcome !== 'missing' || 'probes' in s)) {
      if (!isInt(s.probes)) bad(at, `probes is ${show(s.probes)}; an R1b entry logs the probe variants its attempt wrote, its return's "probes <n>" (D-338)`);
      else if (s.probes > caps.probeCap(s.concept)) fail('probes', `run-log.json ${at}: R1b ${s.concept} logs ${s.probes} probes; ${caps.capWords(s.concept)}`);
      else if (s.outcome === 'fail' && s.probes > 0) fail('probes', `run-log.json ${at}: R1b ${s.concept} failed, but logs ${s.probes} probe(s); probes run only after the skeleton's last compile succeeded (§7.7)`);
    }
    if (!isInt(s.attempt, 1)) bad(at, 'attempt is an integer from 1');
    if (!OUTCOMES.includes(s.outcome)) bad(at, `outcome ${show(s.outcome)} isn't one of ${OUTCOMES.join(', ')}`);
    else if (s.outcome === 'escalated' && !['D1-gate', 'D2-gate', ...(v4 ? ['F1'] : [])].includes(s.stage)) {
      fail('escalation', `run-log.json ${at}: ${s.stage} is logged escalated; only the D1 and D2 gates${v4 ? ' and F1' : ''} escalate, and verification never does (S2${v4 ? ', D-413' : ''})`);
    } else if (!['missing', REFUSED].includes(s.outcome) && !outcomes[s.stage].includes(s.outcome)) {
      bad(at, `a ${s.stage} entry's outcome is one of ${[...outcomes[s.stage], 'missing', ...(v4 ? [REFUSED] : [])].join(', ')}, not ${show(s.outcome)}`);
    }
    if ('priceOutcomes' in s) {
      const p = s.priceOutcomes;
      if (!PRICING_STAGES[v3 ? 3 : 2].includes(s.stage)) bad(at, `has priceOutcomes, but ${s.stage} doesn't price (pricing.md)`);
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
  const displays = Array.isArray(log.displays) ? log.displays.filter(isObj) : [];
  // D-475 (amendment 13, Appendix A): a brainstorm display's number-to-id map, `{"1": "<card id>", …}`, numbered from 1.
  displays.forEach((d, k) => {
    if (!('numbers' in d)) return;
    const n = d.numbers;
    const keys = isObj(n) ? Object.keys(n) : [];
    if (d.checkpoint !== 'brainstorm' || !isObj(n) || keys.some((x, j) => x !== String(j + 1)) || !Object.values(n).every((v) => new RegExp(`^${CARD_ID}$`).test(String(v)))) {
      bad(`displays[${k}]`, `has numbers ${show(n)}; only a brainstorm display records them, {"1": "<card id>", …}, each number the display printed from 1 and the card it named (D-475, Appendix A)`);
    }
  });
  arr('checkpoints').forEach((c, i) => {
    const at = `checkpoints[${i}]`;
    if (!isObj(c)) return bad(at, 'is an object');
    if (!CHECKPOINTS[v3 ? 3 : 2].includes(c.checkpoint)) {
      bad(at, `checkpoint ${show(c.checkpoint)} isn't ${v3 ? '"brainstorm", "verification", "design", "final", "unsaved-build" or "escalation" (D-289, D-362; schema 2\'s checkpoints 1 and 2 are the verification and final gates)' : '1, 2, "unsaved-build" or "escalation"'}`);
    }
    if (!isInt(c.visit, 1)) bad(at, 'visit is an integer from 1');
    else if (v3) {
      // visit counts that gate's or question's visits from 1, in log order.
      const want = (visits.get(c.checkpoint) ?? 0) + 1;
      visits.set(c.checkpoint, want);
      if (c.visit !== want) bad(at, `is visit ${c.visit} of ${show(c.checkpoint)}, but it is that checkpoint's entry ${want}; visit counts its visits from 1`);
    }
    if (v3) checkGateAnswer(c, at, bad, schema);
    // D-367: run-log.mjs records a gate visit's display in displays[] before it logs that visit's answer.
    if (v3 && DISPLAYED.includes(c.checkpoint) && !displays.some((d) => d.checkpoint === c.checkpoint && d.visit === c.visit)) {
      fail('display', `run-log.json ${at}: ${c.checkpoint} visit ${c.visit} has no display in displays[]; every gate visit prints its display first, run-log.mjs display ${c.checkpoint}, and only then logs its answer (D-367)`);
    }
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
    if (!['D1-gate', 'D2-gate', ...(v4 ? ['F1'] : [])].includes(e.stage)) fail('escalation', `run-log.json ${at}: stage is ${show(e.stage)}; only the D1 and D2 gates${v4 ? ' and F1' : ''} escalate (S2${v4 ? ', D-413' : ''})`);
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
  if ('outputs' in log && !v4) {
    const o = log.outputs;
    if (!isObj(o) || !['plan', 'record', 'dossier', 'guide', 'pobFile'].every((k) => k in o)) {
      bad('outputs', 'is {plan, record, dossier, guide, pobFile}');
    }
    // D-260: the import code's one home is compile-record.json (and the guide W1 copies it into).
    if (isObj(o) && 'importCode' in o) bad('outputs', "has importCode; the import code's one home is compile-record.json, which outputs.record names (D-260)");
  }
}

/**
 * D-444 (amendment 11), for the entries a log is held to its rules (§19): after a rate limit or a lockout, no step makes
 * a trade-site request until the user approves a retry at a gate (`retry-pricing`), or a resume clears the stop; poe.ninja's
 * exchange stays allowed. Each held entry counting a `rate_limited` or `locked_out` call has its `pricing.stops[]`
 * entry, and each stop names a step that counted it; each retry answers a stop still open when the gate asked; and a
 * pricing step while a stop is open counts no call but `exchange`, the calls priced from poe.ninja's currency exchange.
 */
function checkPricing(log, fail) {
  const from = heldFrom(log);
  if (from === Infinity || !Array.isArray(log.stages)) return;
  const stages = log.stages;
  const p = isObj(log.pricing) ? log.pricing : { stops: [], retries: [] };
  const stops = list(p.stops).filter((x) => isInt(x.at));
  const retries = list(p.retries);
  const at = (i) => `run-log.json stages[${i}] (${isObj(stages[i]) ? describe(stages[i]) : 'no entry'})`;
  stops.forEach((x, k) => {
    const s = stages[x.at];
    if (!isObj(s) || s.stage !== x.step || !isInt(s.priceOutcomes?.[x.outcome], 1)) fail('pricing', `run-log.json pricing.stops[${k}] names ${x.step} at stages[${x.at}] after ${x.outcome}, but ${at(x.at)} counts no ${x.outcome} call; a stop is recorded at the step whose priceOutcomes hit it (D-444)`);
  });
  stages.forEach((s, i) => {
    if (i < from || !isObj(s)) return;
    const hit = stopOutcome(s.priceOutcomes);
    if (hit !== null && !stops.some((x) => x.at === i)) fail('pricing', `${at(i)} counts a ${hit} call, but pricing.stops records no stop at stages[${i}]; run-log.mjs records one with the step's entry, and pricing stops until a gate's retry-pricing (D-444)`);
  });
  retries.forEach((r, k) => {
    if (!isInt(r.at)) return;
    const last = stops.filter((x) => x.at < r.at).pop();
    const cleared = last !== undefined && (retries.slice(0, k).some((q) => q.answer === 'retry-pricing' && isInt(q.at) && q.at > last.at)
      || list(log.resumes).some((x) => isInt(x.lengths?.stages) && x.lengths.stages > last.at && x.lengths.stages <= r.at));
    if (last === undefined || cleared) fail('pricing', `run-log.json pricing.retries[${k}] answers ${show(r.answer)} at the ${r.checkpoint} gate, but no stop was open then; a gate asks whether to retry pricing only after a stop, before a retry-pricing or a resume cleared it (D-444)`);
  });
  stages.forEach((s, i) => {
    if (i < from || !isObj(s) || !isObj(s.priceOutcomes)) return;
    const trade = Object.entries(s.priceOutcomes).filter(([k, n]) => k !== EXCHANGE && isInt(n, 1));
    if (trade.length === 0) return;
    const stop = openStop(log, i);
    if (stop !== null) {
      fail('pricing', `${at(i)} makes ${trade.reduce((a, [, n]) => a + n, 0)} trade-site price call(s) (${trade.map(([k, n]) => `${k} ${n}`).join(', ')}), but pricing stopped at stages[${stop.at}] (${stop.step}, ${stop.outcome}) and no gate's retry-pricing, nor a resume, came after it; until the user approves a retry, a step prices only from poe.ninja's exchange, counted as exchange (D-444)`);
    }
  });
}

// ---------------------------------------------------------------------------------------------------
// The control flow (SKILL.md's step list; amendment 1 §3, S6; the accepted cost of S1)
// ---------------------------------------------------------------------------------------------------

/** Whether a fault target names `concept`. */
const targets = (target, concept) => isObj(target) && (target.concepts === 'all' || (Array.isArray(target.concepts) && target.concepts.includes(concept)));
/** A step's family for the order rules: a V4 lens's full pass is `V4`, its re-check `V4r`. */
/** A step's family in the flow: a re-check `V4r`, a campaign pass `V4c`, a file-only build's claims pass `V4k` (D-477). */
const familyOf = (s) => (s.stage === 'V4-recheck' ? 'V4r' : s.stage === 'V4-campaign' ? 'V4c' : s.stage === 'V4-claims' ? 'V4k' : s.stage);
const sameStep = (a, b) => a.stage === b.stage && (a.concept ?? null) === (b.concept ?? null);
const describe = (s) => `${s.stage}${s.concept ? ` ${s.concept}` : ''} attempt ${s.attempt}`;

/**
 * The run's control flow, read from `stages[]` with `checkpoints[]` and `escalations[]`. It stands in for the
 * workflow harness tests amendment 1 deleted (the accepted cost of S1):
 *  - `order`: the steps run in SKILL.md's order, each design through D1 (D1-build then D1-finish, D-356; one D1
 *    step in a schema-2 log), its gate, the design gate (D-362), D2, its gate and W1 for one card; attempts number
 *    every call; a missing return re-runs once, and a second miss ends the run. In a schema-3 log each gate visit
 *    has its answer, in order, and the next step is the one it leads to (D-287): the brainstorm gate's
 *    `pick:<ids>` a verification round of those cards, in that order; the verification gate's `pick:<id>` that
 *    card's design, `verify:<ids>` a verification round without a brainstorm; the design gate's `accept` D2,
 *    `revise:<text>` D1 again (D1-build, or D1-finish), then its gate and the design gate again, `verification` the
 *    verification gate; `more` a brainstorm round; `stop` the end of the run. The final gate's last answer gives
 *    the run's end status: `accept` completed, the default `stop` stopped, any other answer but `revise:<text>`
 *    not-accepted.
 *  - `design-gate`: in the design phase (before the design's guide is verified: not in a fix round or a revision),
 *    D2 comes only after a design gate visit answered `accept`, which follows a passing D1 gate or an escalation
 *    accepted there (D-362).
 *  - `caps`: per brainstorm round at most 3 R1a researchers and one R1a-assemble, per verification round at
 *    most 3 cards compiled (NFR-23, D-287; a schema-2 log's research round carries at most 3 concepts, D-235), the
 *    rival's aside (D-408); R1b at most 3 counted attempts, none after a terminal `not-a-skill`, `wrong-ascendancy`,
 *    `not-in-pin` or `not-dealt` failure (D-334, D-342, D-400, D-408); each gate at most 2 counted retries, then an
 *    escalation (S6: an attempt-1 fault's failure is free, a persistent fault's attempts count; a guided retry and an
 *    accepted re-run escalate again on failure).
 *  - the rival (D-408): its step `RV` runs once per run right after the R1b-assemble that closes the first
 *    verification round, before that gate's visit; when it wrote its card `r<k>-x-<n>` (`done`), that card's R1b and a
 *    second R1b-assemble come next, then the verification gate; when it found no faster structure (`none-found`), the
 *    gate comes next. Any other RV step runs at a gate the user asked at, like a gate question step, and leads nowhere:
 *    its card is verified when a gate's answer picks it.
 *  - `verification` (D-352): one full V4 pass per guide; after it, one fix round only when it found something,
 *    then one re-check (V4-recheck); a revision the final gate asked for starts with its owners and checks with a
 *    re-check, never a full pass, and its re-check may have its own fix round and re-check. A claims-only owner
 *    (`claims-edited`) runs only before any gate of its fix round or revision, and no gate follows it.
 *  - `escalation`: only gates escalate, each escalation logged once, in order, its choice the answer to its
 *    escalation question, and the choice followed.
 *  - `routing`: each gate attempt's logged outcome is the one its verdict file routes to (gates.md).
 * `ctx` gives the log's schema, a gate attempt's verdict file, the stage each fault breaks, an R1b failure's
 * terminal code (or null) and whether a card exists; findings accepted at an escalation cover the gate attempts
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
  /** The step a D1 attempt starts with: D1-build (D-356), or a schema-2 log's one D1. */
  const D1_START = v3 ? 'D1-build' : 'D1';
  /** The step D1's fix-round or revision chain starts with: D1-finish first (fix-round.md), or schema 2's D1. */
  const D1_OWNER = v3 ? 'D1-finish' : 'D1';
  /** The D1 step that ends an attempt, after which its gate runs. */
  const D1_END = v3 ? 'D1-finish' : 'D1';

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
  // researchers finish in any order); a second miss of the step ends the run stopped.
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
  // Schema 3: each visit of the brainstorm, verification and design gates takes that gate's next answer, in order.
  const GATES = ['brainstorm', 'verification', 'design'];
  const answers = Object.fromEntries(GATES.map((g) => [g, checkpoints.filter((c) => c.checkpoint === g)]));
  const GATE_NAME = { brainstorm: 'the brainstorm gate', verification: 'the verification gate', design: 'the design gate' };

  // D-408: the rival's own step, the first RV to return its file right after the R1b-assemble that closes the first
  // verification round (schema 3's first assembly). Any other RV runs at a gate the user asked at.
  const firstAssembly = v3 ? stages.findIndex((s) => s.stage === 'R1b-assemble' && s.outcome !== 'missing') : -1;
  const afterAssembly = firstAssembly >= 0 ? stages.slice(firstAssembly + 1).find((s) => s.outcome !== 'missing') : undefined;
  const autoRival = afterAssembly?.stage === 'RV' ? afterAssembly : null;
  const rivalIds = rivalCards(stages);
  /** A step that runs at a gate, between its display and its answer, and leads nowhere (D-390, D-408). */
  const atGate = (s) => s.stage === 'Q' || (s.stage === 'RV' && s !== autoRival);
  // A gate question step (D-390), and a rival the user asked for at a gate (D-408), run at a gate, between its display
  // and its answer, and lead nowhere: the order rules read past them.
  const steps = stages.map((s, i) => ({ s, i })).filter(({ s }) => s.outcome !== 'missing' && !atGate(s));
  let prev = null;
  let esc = 0;
  let lastEscalation = null;
  let round = null; // schema 2: a research round {n, r1a, concepts}; schema 3: a brainstorm round {n, r1a, assembles}
  let rounds = 0;
  let vround = null; // schema 3: the open verification round {n, gate, expected, cards}
  let vrounds = 0;
  let finalized = null; // schema 3: the card the verification gate's last pick finalized, whose design comes next
  const r1bSeen = new Map(); // concept -> {round, counted, passed, terminal: null or the terminal R1b code}
  /** Whether a card's R1b failed with retries left: its next attempt runs before any other card's, or the assembly. */
  const retriesLeft = (c) => {
    const r = r1bSeen.get(c);
    return r !== undefined && !r.passed && !r.terminal && r.counted < R1B_ATTEMPTS;
  };
  const chains = new Map(); // `${gate}|${concept}` -> {counted, guided}
  let design = null; // {concept, verified}: verified once the V4 checks of its guide ran (a fix round or revision)
  let designs = 0;
  let d1 = null; // the D1 attempt in progress: {built: whether D1-build ran in it, infeasible: whether it claimed so}
  /**
   * The V4 checks of the current guide (D-352): `start` 'full' for a design's first guide, 'revision' for a
   * revision's; `first` its first check ('none' or 'done': the full pass, or the revision's re-check) and whether
   * that found anything; `fix` whether its fix round ran; `recheck` the fix round's re-check.
   */
  let cycle = null;
  let revisions = 0;
  const newCycle = (start) => ({ start, first: 'none', failed: false, fix: false, recheck: 'none' });
  /** Schema 3: the gate a step ends at, when the step after it doesn't continue it (D-287, D-362). */
  const gateAfter = (p, next) => {
    if (!v3 || !p) return null;
    if (p.stage === 'R1a-assemble' && next?.stage !== 'R1a-assemble') return 'brainstorm';
    // D-408: the first verification round's assembly goes on to the rival's step, before the gate's visit.
    if (p.stage === 'R1b-assemble') return next !== undefined && next === autoRival ? null : 'verification';
    if (p.stage === 'RV' && p.outcome === 'none-found') return 'verification';
    if (p.stage === 'D1-gate' && p.outcome === 'infeasible') return 'verification';
    // D-362: in the design phase, a passing D1 gate, or one whose escalation the user accepted, goes to the design gate.
    if (p.stage === 'D1-gate' && design !== null && !design.verified && (p.outcome === 'pass' || (p.outcome === 'escalated' && lastEscalation?.choice === 'accept'))) return 'design';
    if (p.outcome === 'escalated' && lastEscalation?.choice === 'verification') return 'verification';
    return null;
  };

  const chain = (gate, concept) => {
    const key = `${gate}|${concept}`;
    if (!chains.has(key)) chains.set(key, { counted: 0, guided: false });
    return chains.get(key);
  };
  const freshChain = (gate, concept) => chains.set(`${gate}|${concept}`, { counted: 0, guided: false });
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
   * (D-287, D-289, D-362). `pick:<ids>` (brainstorm) and `verify:<ids>` open a verification round of those cards;
   * `pick:<id>` (verification) finalizes a card verified in the run, whose design comes next; the design gate's
   * `accept` is D2, `revise:<text>` D1 again, `verification` the verification gate; `more` opens a brainstorm
   * round; `stop` ends the run. Returns the answer's kind, or undefined.
   */
  const followGate = (kind, s, i) => {
    const illegal = (why) => fail('order', `${at(i)}: ${why}`);
    const c = answers[kind].shift();
    const name = GATE_NAME[kind];
    if (c === undefined) {
      // D-362: in the design phase D2 comes only after the design gate's accept.
      if (kind === 'design' && s.stage === 'D2') {
        return fail('design-gate', `${at(i)}: reaches D2 without a design gate visit: checkpoints[] records no design answer after ${design?.concept ?? s.concept}'s D1 gate; in the design phase the design gate runs between the D1 gate and D2, whoever answers, and D2 comes only after its accept (D-362)`);
      }
      return illegal(`follows a visit of ${name}, but checkpoints[] records no ${kind} answer for it; each visit records its answer (D-289${kind === 'design' ? ', D-362' : ''})`);
    }
    const a = String(c.answer);
    const m = /^(pick|verify):(.*)$/s.exec(a);
    if (a === 'stop') return illegal(`follows ${name} answered "stop", which ends the run stopped`);
    if (kind === 'design') {
      if (a === 'accept') {
        if (s.stage !== 'D2' || s.concept !== design?.concept) illegal(`follows the design gate answered "accept", which goes on to ${design?.concept ?? 'the card'}'s D2, not ${s.stage}${s.concept ? ` ${s.concept}` : ''} (D-362)`);
        return 'accept';
      }
      if (a.startsWith('revise:')) {
        if (!['D1-build', 'D1-finish'].includes(s.stage) || s.concept !== design?.concept) illegal(`follows the design gate answered ${show(a)}, which runs ${design?.concept ?? 'the card'}'s D1 again (D1-build, or D1-finish), not ${s.stage} (D-362)`);
        return 'revise';
      }
      if (a === 'verification') return followGate('verification', s, i);
      return illegal(`follows the design gate answered ${show(a)}, which isn't an answer of that gate`);
    }
    if (a === 'more') {
      if (s.stage !== 'R1a') illegal(`follows ${name} answered "more", which starts a brainstorm round (R1a), not ${s.stage}`);
      return 'more';
    }
    if (m && ((kind === 'brainstorm' && m[1] === 'pick') || (kind === 'verification' && m[1] === 'verify'))) {
      const ids = m[2].split(',').filter((x) => x !== '');
      for (const id of ids) if (!ctx.cardExists(id)) fail('deck', `run-log.json checkpoints: ${name} answered ${show(a)}, but ${id} is no card of the run (cards/${id}.md, C-52)`);
      // D-391: the cards made at the gate are verified in the same round, after the picked cards, in newCards' order.
      const made = list(c.newCards).map((n) => n.id);
      const shown = made.length > 0 ? `${show(a)} with the new card(s) ${made.join(', ')}` : show(a);
      if (s.stage !== 'R1b') illegal(`follows ${name} answered ${shown}, which starts a verification round (R1b), not ${s.stage}`);
      vrounds += 1;
      vround = { n: vrounds, gate: `${name}'s ${shown}`, expected: [...ids, ...made], cards: [] };
      return 'verify';
    }
    if (m && kind === 'verification' && m[1] === 'pick') {
      const id = m[2];
      const r = r1bSeen.get(id);
      if (r === undefined) illegal(`follows the verification gate answered ${show(a)}, but no R1b verified ${id} in the run; the gate finalizes a verified card (D-287)`);
      else if (r.terminal === 'not-a-skill') illegal(`follows the verification gate answered ${show(a)}, but ${id}'s damage source isn't a skill (its R1b ended not-a-skill), so it can't be finalized yet (D-303, D-334)`);
      else if (r.terminal === 'wrong-ascendancy') illegal(`follows the verification gate answered ${show(a)}, but ${id}'s ascendancy doesn't own the passive-tree node that grants its skill (its R1b ended wrong-ascendancy), so the build it describes can't exist and it can't be finalized (D-342)`);
      else if (r.terminal === 'not-in-pin') illegal(`follows the verification gate answered ${show(a)}, but ${id} rests on an entry the PoB pin doesn't know (its R1b ended not-in-pin), so it can't be finalized yet (D-303, D-400)`);
      else if (r.terminal === 'not-dealt') illegal(`follows the verification gate answered ${show(a)}, but ${id}, the rival's card, failed R1a-assemble's identity and sniff checks (its R1b ended not-dealt), so it can't be finalized (D-408)`);
      if (s.stage !== D1_START) illegal(`follows the verification gate answered ${show(a)}, which finalizes ${id}: its design (${D1_START}) comes next, not ${s.stage}`);
      finalized = id;
      return 'pick';
    }
    return illegal(`follows ${name} answered ${show(a)}, which isn't an answer of that gate`);
  };
  /** An owner after the V4 checks: the fix round when the last check found something and had none, else a revision. */
  const afterVerification = (s, i) => {
    if (cycle === null || design === null || s.concept !== design.concept) {
      fail('order', `${at(i)}: follows the V4 checks of another design`);
      return;
    }
    if (cycle.first === 'done' && cycle.failed && !cycle.fix) cycle.fix = true;
    else {
      revisions += 1;
      cycle = newCycle('revision');
    }
    design.verified = true;
  };

  for (const { s, i } of steps) {
    const f = familyOf(s);
    const pf = prev ? familyOf(prev.s) : 'start';
    const p = prev?.s;
    const same = p !== undefined && p.concept === s.concept;
    const illegal = (why) => fail('order', `${at(i)}: ${why}`);
    // After the V4 checks: a full pass or a re-check.
    const postVerify = pf === 'V4' || pf === 'V4r';
    // A D1 attempt starts at D1-build, or in a fix round, a revision or a design-gate revise at D1-finish; the
    // D1-build a D1-finish's `build:` return asks for continues its attempt (fix-round.md, D-356).
    const startsD1 = D1_STAGES.includes(s.stage) && !(v3 && ((s.stage === 'D1-finish' && pf === 'D1-build' && same) || (s.stage === 'D1-build' && pf === 'D1-finish' && same && p.outcome === 'done')));

    // What the previous step's outcome allows next: in a schema-3 log, a gate's answer (D-287, D-362).
    const gate = gateAfter(p, s);
    let via = null;
    if (gate !== null) {
      via = followGate(gate, s, i) ?? null;
    } else if (p && p.outcome === 'escalated') {
      const e = lastEscalation;
      const choice = e?.choice;
      const ok =
        choice === 'accept' ? same && (p.stage === 'D1-gate' ? s.stage === 'D2' || (design?.verified && s.stage === 'D2-gate') : s.stage === 'D2-gate')
          : choice === 'retry' ? same && s.stage === (p.stage === 'D1-gate' ? D1_START : 'D2')
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
        // D-408: the first verification round's assembly, then the rival; its card's R1b after a card (`done`).
        'R1b-assemble': ['RV'],
        RV: p?.outcome === 'done' ? ['R1b'] : [],
      } : {
        start: ['R1a'],
        R1a: ['R1a', 'R1b', 'R1b-assemble'],
        R1b: ['R1b', 'R1b-assemble'],
        'R1b-assemble': ['R1a', 'D1'],
      };
      // After the V4 checks, the owners (fix-round.md): D1 first (D1-finish), D2, then W1, which always runs last.
      const owners = [D1_OWNER, 'D2', 'W1'];
      // The guide's next check (D-352): its full pass, or for a revision its re-check; after a fix round, its re-check.
      const nextCheck = cycle !== null && (cycle.first === 'done' ? cycle.fix : cycle.start === 'revision') ? 'V4r' : 'V4';
      const allowed = {
        ...research,
        // D-356: D1-build, then D1-finish; a D1-finish that opened a fix-round or revision chain may hand its build
        // findings to D1-build (`build:`), which D1-finish follows once more.
        'D1-build': ['D1-finish'],
        // D-264: a claims-only D1 runs no gate; D2 (a claims-only one, or one that recompiles) or W1 follows.
        [D1_END]: p?.outcome === CLAIMS_EDITED ? ['D2', 'W1'] : v3 && !d1?.built ? ['D1-gate', 'D1-build'] : ['D1-gate'],
        'D1-gate': p?.outcome === 'pass' ? ['D2', ...(design?.verified ? ['D2-gate'] : [])] : p?.outcome === 'fail' ? [D1_START] : [D1_START, 'R1a'],
        D2: p?.outcome === CLAIMS_EDITED ? ['W1'] : ['D2-gate'],
        'D2-gate': p?.outcome === 'pass' ? ['W1'] : ['D2'],
        W1: [nextCheck],
        V4: ['V4', ...owners],
        V4r: ['V4r', ...owners],
      }[pf] ?? [];
      if (!allowed.includes(f)) illegal(`can't follow ${p ? describe(p) : 'the start'} (outcome ${show(p?.outcome)}); SKILL.md's step list allows ${allowed.join(', ').replace(/\bV4r\b/g, 'V4-recheck') || 'nothing'} next`);
      const keepsConcept = [...D1_STAGES, 'D1-gate', 'D2', 'D2-gate', 'W1'].includes(pf) || ((pf === 'V4' || pf === 'V4r') && f !== 'R1a');
      if (keepsConcept && p && !ROUND_STAGES.includes(s.stage) && !(pf === 'D1-gate' && p.outcome === 'infeasible') && !same) {
        illegal(`is about ${s.concept}, but the design before it is ${p.concept}'s; a design runs through D1, its gate, D2, its gate, W1 and V4 for one ${v3 ? 'card' : 'concept'}`);
      }
    }
    // D-264: a claims-only owner edits in place before any gate of its fix round or revision: right after the V4
    // checks, or (D2) right after a claims-only D1. Once a gate re-ran, the final record is gone, so D2 runs its gate.
    if (s.outcome === CLAIMS_EDITED && !((postVerify && s.stage !== 'D1-build') || (s.stage === 'D2' && pf === D1_END && p?.outcome === CLAIMS_EDITED))) {
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
            // D-408: the rival's R1b is outside the cap of 3 per verification round.
            const capped = vround.cards.filter((c) => !RIVAL_CARD.test(c)).length;
            if (!RIVAL_CARD.test(s.concept) && capped > ROUND_CAP) fail('caps', `${at(i)}: verification round ${vround.n} compiles ${capped} cards; at most ${ROUND_CAP} per verification round (D-287, NFR-23), the rival's aside (D-408)`);
          }
        }
      } else {
        if (seen && round && seen.round !== round.n) illegal(`runs R1b for ${s.concept} again in research round ${round.n}; concept ids are unique across rounds`);
        if (round && !round.concepts.has(s.concept)) {
          round.concepts.add(s.concept);
          if (round.concepts.size > ROUND_CAP) fail('caps', `${at(i)}: research round ${round.n} carries ${round.concepts.size} concepts; at most ${ROUND_CAP} per round (D-235)`);
        }
      }
      const r = seen ?? { round: v3 ? vround?.n : round?.n, counted: 0, passed: false, terminal: null };
      r1bSeen.set(s.concept, r);
      if (r.terminal === 'not-a-skill') illegal(`runs R1b for ${s.concept} again, but its last attempt ended not-a-skill with no compile: its damage source isn't a skill, so no retry can compile it (D-334)`);
      else if (r.terminal === 'wrong-ascendancy') illegal(`runs R1b for ${s.concept} again, but its last attempt ended wrong-ascendancy with no compile: its ascendancy doesn't own the passive-tree node that grants its skill, so no retry can change it (D-342)`);
      else if (r.terminal === 'not-in-pin') illegal(`runs R1b for ${s.concept} again, but its last attempt ended not-in-pin with no compile: it rests on an entry the PoB pin doesn't know, so no retry can compile it (D-400)`);
      else if (r.terminal === 'not-dealt') illegal(`runs R1b for ${s.concept} again, but its last attempt ended not-dealt with no compile: the rival's card failed R1a-assemble's identity and sniff checks, so no retry can deal it (D-408)`);
      else if (r.passed) illegal(`runs R1b for ${s.concept} after it compiled`);
      else if (r.counted >= R1B_ATTEMPTS) fail('caps', `${at(i)}: is a counted R1b attempt for ${s.concept} after ${r.counted}; R1b allows 2 counted retries, then the ${v3 ? 'card' : 'concept'} is failed (Q2)`);
      if (p && p.stage === 'R1b' && p.outcome === 'fail' && p.concept !== s.concept && retriesLeft(p.concept)) {
        illegal(`R1b ${p.concept} failed with retries left, but the next R1b is ${s.concept}'s; a failed compile re-runs first`);
      }
      if (s.outcome === 'pass') r.passed = true;
      const terminal = ctx.terminal(s);
      if (terminal) r.terminal = terminal;
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
    // D-408: the rival's card goes through R1b inside the first verification round, then a second R1b-assemble pass.
    if (s === autoRival && s.outcome === 'done') {
      vround = { n: vrounds, gate: "the rival's step (RV, D-408)", expected: [rivalIds.get(s)], cards: [] };
    }

    // Designs, chains and caps (gates.md; S6).
    if (startsD1) {
      d1 = { built: false, infeasible: false };
      if (pf === 'D1-gate' && p.outcome === 'fail' && same) {
        // a counted retry, or a free one after an attempt-1 fault
      } else if (pf === 'D1-gate' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
        chain('D1-gate', s.concept).guided = true;
      } else if (postVerify) {
        afterVerification(s, i);
        freshChain('D1-gate', s.concept);
      } else if (via === 'revise') {
        // D-362: a design-gate revise counts against no cap; the D1 gate in it keeps its 2 counted retries.
        freshChain('D1-gate', s.concept);
      } else if (s.outcome !== CLAIMS_EDITED) freshDesign(s, i);
    }
    if (D1_STAGES.includes(s.stage) && d1 !== null) {
      if (s.stage !== 'D1-finish') d1.built = true;
      if (s.stage !== 'D1-finish' && s.outcome === 'infeasible') d1.infeasible = true;
    }
    if (s.stage === 'D2') {
      if (pf === 'D2-gate' && p.outcome === 'fail' && same) {
        // a retry
      } else if (pf === 'D2-gate' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
        chain('D2-gate', s.concept).guided = true;
      } else {
        if (postVerify) afterVerification(s, i);
        freshChain('D2-gate', s.concept);
      }
    }
    if (s.stage === 'D2-gate' && pf === 'D1-gate') freshChain('D2-gate', s.concept);
    if (s.stage === 'D2-gate' && pf === 'D2-gate' && p.outcome === 'escalated' && lastEscalation?.choice === 'accept') chain('D2-gate', s.concept).guided = true;
    if (s.stage === 'W1' && postVerify) afterVerification(s, i);
    if (s.stage === 'W1' && pf === 'D2-gate' && cycle === null) cycle = newCycle('full');
    // Each gate attempt routes as its own verdict file says (gates.md's outcome tables).
    if (GATE_STAGES.includes(s.stage)) {
      const rep = ctx.verdict(s);
      const file = `reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`;
      const guided = s.stage !== 'R1b' && chain(s.stage, s.concept).guided;
      const counted = s.stage !== 'R1b' ? chain(s.stage, s.concept).counted : 0;
      if (!isObj(rep) || !isObj(rep.verdict)) fail('routing', `${at(i)}: has no verdict file ${file}; a gate step writes its own, and the runner routes on it (§3)`);
      else {
        const cls = gateClass(rep, s.stage, coveredSoFar);
        // D-356: D1-build claims infeasible, and D1-finish runs before the gate all the same.
        const claimedInfeasible = s.stage === 'D1-gate' && D1_STAGES.includes(p?.stage) && p.concept === s.concept && d1?.infeasible === true;
        const why = {
          pass: cls === 'pass' ? null : `its verdict ${describeClass(cls)}, which isn't a pass`,
          fail: cls === 'hard' || cls === 'soft' ? (guided ? 'a guided retry or an accepted re-run that fails escalates again' : null) : `its verdict ${describeClass(cls)}, which isn't a failure`,
          escalated: cls === 'hard' || (guided && cls === 'soft') ? null : `its verdict ${describeClass(cls)}; only a compile, V1 or V2 failure escalates, or any failure of a guided retry`,
          infeasible:
            cls === 'forced' ? (forcedByFault(s) ? null : 'its verdict is forced infeasible, but no FI-3 directive targets this attempt')
              : cls !== 'soft' ? `its verdict ${describeClass(cls)}; infeasible is FI-3's forced verdict, or a floor or named-damage-source (rolledSkill) failure (the budget never fails, D-371)`
                : guided ? 'a guided retry that fails escalates again'
                  : claimedInfeasible || counted >= GATE_RETRIES ? null : `${D1_START} claimed done and the gate has ${counted} counted retr${counted === 1 ? 'y' : 'ies'}; a floor or named-damage-source (rolledSkill) failure re-runs D1 until its 2 counted retries, unless ${D1_START} claimed infeasible`,
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

    // The V4 checks (D-352): one full pass per guide; then, when it found something, one fix round and its
    // re-check; a revision checks with a re-check, never a full pass, and its re-check may have its own fix round.
    if (f === 'V4') {
      if (cycle === null) illegal('runs a V4 pass with no guide written for this design');
      else if (cycle.start === 'revision') fail('verification', `${at(i)}: runs a full V4 pass after a revision; a revision runs no full pass, its owners' changes get a re-check (V4-recheck) of what check-run.mjs --changed lists (D-352)`);
      else if (cycle.first === 'done') fail('verification', `${at(i)}: starts a second full V4 pass for one guide; after the fix round a re-check (V4-recheck) covers what changed, and a revision ${G.final} asked for checks with a re-check too (D-352)`);
      else {
        cycle.first = 'done';
        cycle.failed = s.outcome === 'fail';
      }
    }
    if (f === 'V4r') {
      if (cycle !== null && cycle.start === 'revision' && cycle.first === 'none') {
        cycle.first = 'done';
        cycle.failed = s.outcome === 'fail';
      } else if (!cycle || cycle.first !== 'done' || !cycle.fix) fail('verification', `${at(i)}: re-checks with no fix round or revision before it; a re-check follows the owners of a fix round (after a check that found something) or of a revision (D-352)`);
      else if (cycle.recheck === 'done') fail('verification', `${at(i)}: starts a second re-check after one fix round; there is no further round, what stays open is a known issue (D-352)`);
      else cycle.recheck = 'done';
    }
    prev = { s, i };
  }

  // Schema 3: a run that ends at a gate takes that visit's answer too; stop ends it stopped, and any other answer
  // leaves a step to come, so the run is still running. No gate has an answer left over (D-287, D-289, D-362).
  let end = gateAfter(prev?.s, undefined);
  while (end !== null) {
    const c = answers[end].shift();
    const name = GATE_NAME[end];
    // A gate question step, or a rival asked for at a gate, after the last step runs at its gate (D-390, D-408), so
    // the run still ends there.
    const atEnd = stages.filter((x) => !atGate(x)).pop() === prev.s;
    // D-362: the design gate's "verification" goes on to the verification gate, which takes its own answer.
    if (end === 'design' && c?.answer === 'verification') {
      end = 'verification';
      continue;
    }
    if (atEnd) {
      if (c === undefined && log.status !== 'running') fail('order', `run-log.json: the run ends at ${name} with no ${end} answer recorded, but its status is ${show(log.status)}; a run that stops there records the answer stop`);
      else if (c?.answer === 'stop' && log.status !== 'stopped') fail('order', `run-log.json: ${name} answered "stop", which ends the run stopped, but its status is ${show(log.status)}`);
      else if (c !== undefined && c.answer !== 'stop' && log.status !== 'running') fail('order', `run-log.json: ${name} answered ${show(c.answer)}, but no step follows it and the run ends ${show(log.status)}`);
    }
    // D-303, D-342: a pre-supplied pick of a card the gate can't finalize is illegal, and the run stops; a pick
    // of any other card is followed, never turned into a stop.
    const picked = end === 'verification' && c?.answer === 'stop' && c.answeredBy === 'pre-supplied' ? /^pick:(.+)$/.exec(String(c.rule))?.[1] : undefined;
    if (picked !== undefined && !r1bSeen.get(picked)?.terminal) {
      fail('order', `run-log.json: the verification gate's pre-supplied ${show(c.rule)} ended the run with "stop", but ${picked} can be finalized; a pre-supplied pick stops the run only when its card can't be (its R1b ended wrong-ascendancy, not-a-skill, not-in-pin or not-dealt; D-303, D-342, D-400, D-408)`);
    }
    end = null;
  }
  for (const kind of v3 ? GATES : []) {
    if (answers[kind].length > 0) fail('order', `run-log.json: checkpoints[] records ${answers[kind].length} ${kind} answer(s) more than the run visits ${GATE_NAME[kind]}; each visit records one answer, in order (D-289)`);
  }

  if (esc !== escalations.length) fail('escalation', `run-log.json escalations[] has ${escalations.length} entr${escalations.length === 1 ? 'y' : 'ies'}, but stages[] logs ${esc} escalated gate attempt(s); every escalation is logged once, in order`);
  // Each escalation's question is recorded as checkpoint `escalation`, in order, and escalations[k]'s choice is the
  // k-th one's answer (checkpoints.md, "Escalations"): `retry:<guidance>` is the choice retry with that guidance.
  const asked = checkpoints.filter((c) => c.checkpoint === 'escalation');
  escalations.forEach((e, k) => {
    const c = asked[k];
    const want = e.choice === 'retry' ? `retry:${e.guidance}` : e.choice;
    if (c === undefined) {
      fail('escalation', `run-log.json escalations[${k}] (${e.stage} ${e.concept}) has no escalation answer: checkpoints[] records ${asked.length} escalation question(s); each escalation records its question's answer as checkpoint "escalation", in order (checkpoints.md)`);
    } else if (c.answer !== want || (e.choice === 'retry' && typeof e.guidance !== 'string')) {
      fail('escalation', `run-log.json escalations[${k}] logs the choice ${show(e.choice)}${e.choice === 'retry' ? ` with guidance ${show(e.guidance)}` : ''}, but checkpoints[${checkpoints.indexOf(c)}], escalation answer ${k + 1}, is ${show(c.answer)}; the choice is the answer, and retry:<guidance> is retry with that guidance (checkpoints.md)`);
    }
  });
  if (asked.length > escalations.length) fail('escalation', `run-log.json checkpoints[] records ${asked.length} escalation answer(s), but escalations[] has ${escalations.length} entr${escalations.length === 1 ? 'y' : 'ies'}; each answer is an escalation's, logged in escalations[] in order (checkpoints.md)`);
  if (revisions > revises) fail('verification', `run-log.json stages[] runs ${revisions} revision(s) after the V4 checks, but ${G.final} was answered revise:<text> ${revises} time(s); without findings to fix, only a revision runs the owners again`);
  const last = steps[steps.length - 1]?.s;
  if (last?.outcome === 'escalated' && lastEscalation?.choice === 'stop' && log.status !== 'escalated') {
    fail('escalation', `run-log.json: the last step is ${describe(last)}'s escalation, answered stop, but the status is ${show(log.status)}; the run ends escalated`);
  }
  if (log.status === 'escalated' && !(last?.outcome === 'escalated' && lastEscalation?.choice === 'stop')) {
    fail('escalation', 'run-log.json: status is "escalated", but the run doesn\'t end with a gate escalation answered stop');
  }
  // The final gate's last answer ends the run (checkpoints.md, "The final gate"): accept ends it completed; the
  // default stop (no final answer left) stopped; revise:<text> is a revision, with steps to come; any other
  // answer not-accepted.
  const lastFinal = checkpoints.filter((c) => c.checkpoint === G.finalKey).pop();
  const lastAnswer = lastFinal?.answer;
  const endsAs = typeof lastAnswer !== 'string' || lastAnswer.startsWith('revise:') ? null
    : lastAnswer === 'accept' ? 'completed'
      : lastAnswer === 'stop' && lastFinal.answeredBy === 'default' ? 'stopped'
        : 'not-accepted';
  if (log.status === 'completed' && lastAnswer !== 'accept') {
    fail('order', `run-log.json: status is "completed", but ${G.final}'s last answer is ${show(lastAnswer)}; only an accept at ${G.final} completes a run`);
  } else if (endsAs !== null && log.status !== endsAs) {
    fail('order', `run-log.json: ${G.final}'s last answer is ${show(lastAnswer)}${lastFinal.answeredBy === 'default' ? ' by default' : ''}, which ends the run ${endsAs}, but its status is ${show(log.status)} (checkpoints.md)`);
  } else if (log.status === 'not-accepted' && endsAs !== 'not-accepted') {
    fail('order', `run-log.json: status is "not-accepted", but ${G.final}'s last answer is ${show(lastAnswer)}; only an answer at ${G.final} other than accept, revise:<text> and the default stop ends a run not-accepted (checkpoints.md)`);
  }
  if (log.status === 'completed' && !(cycle && cycle.first === 'done' && (!cycle.failed || cycle.recheck === 'done'))) {
    fail('verification', "run-log.json: status is \"completed\", but the run doesn't end with its guide's check (the full pass, or a revision's re-check) and, when that found anything, the fix round's re-check (D-352)");
  }
}

/**
 * Where a schema-4 gate verdict routes (gates.md as amendment 9 amends it): `forced` (FI-3); for F1, `ledger` (the
 * write ledger refused the final compile, D-211: it escalates at once) or `hard`; `hard` (a compile, V1 or V2 failure,
 * or a part other than the budget and the tree unverified); `soft` (floor or the named damage source); `tree` (only the
 * tree part: a swap left that gains 5% or more, D-419, which re-runs D1-tree); `toolError` (only the tree unverified,
 * `get_node_power` failed: the gate re-runs alone, once); or `pass`. A failing part whose findings an escalation
 * accepted passes.
 */
function gateClass4(rep, stage, covered) {
  if (rep.forced === 'infeasible') return 'forced';
  if (stage === 'F1') return ledgerRefused(rep) ? 'ledger' : gateClass(rep, 'F1', covered) === 'pass' ? 'pass' : 'hard';
  const parts = partsOf(rep, stage);
  const failing = parts.filter((part) => {
    if (part === 'budget') return false;
    const v = rep.verdict[part];
    if (part === 'tree' && v === 'unverified') return false;
    if (v === 'unverified') return true;
    if (v !== 'fail') return v !== 'pass';
    const findings = list(rep.findings).filter((f) => f.part === part && !INFO_CODES.includes(f.code));
    return part === 'compiled' || findings.length === 0 || findings.some((f) => !covered(f));
  });
  if (failing.some((part) => ['compiled', 'v1', 'v2'].includes(part))) return 'hard';
  if (failing.some((part) => ['floor', 'rolledSkill'].includes(part))) return 'soft';
  if (failing.includes('tree')) return 'tree';
  if (parts.includes('tree') && rep.verdict.tree === 'unverified') return list(rep.findings).some((f) => f.part === 'tree' && f.code === TOOL_ERROR) ? 'toolError' : 'hard';
  return 'pass';
}
/** The steps about one build (D-411): its design, final compile, guide and checks. */
const BUILD_STEPS = ['D1-build', 'D1-tree', 'D1-finish', 'D1-gate', 'D2', 'D2-gate', 'F1', 'W1', 'V4', 'V4-recheck', 'V4-campaign'];
const describeClass4 = (cls) => ({ ledger: "is the write ledger's refusal (ledger-refused)", tree: 'fails only its tree part (a swap left gains 5% or more)', toolError: "leaves only its tree unverified, get_node_power having failed (tool-error)" })[cls] ?? describeClass(cls);

/**
 * Schema 4's control flow (amendment 9: D-411…D-415, D-418, D-419, D-421), read from `stages[]` with `checkpoints[]`,
 * `escalations[]` and `resumes[]`, per build:
 *  - the research and verification rounds as in schema 3; the verification gate's `pick:<id>[,<id>…]` queues 1–3 cards,
 *    in the user's order and ahead of the cards still queued, and the first queued card's design comes next;
 *  - a design: D1-build, D1-tree, D1-finish, the D1 gate (D-418), then the design gate; a `tree` failure re-runs D1-tree,
 *    then D1-finish; a `tool-error` re-runs the gate alone, once, and a second escalates (D-419);
 *  - the design gate: `accept` and `accept:file` go to F1, `revise:<text>` to D1 (D1-build, D1-tree or D1-finish),
 *    `verification` drops the build, `stop` stops it and the next queued card's design starts;
 *  - F1 (D-413): a pass goes to W1, or after `accept:file` ends the build `file-only`; a failure re-runs F1 once, a
 *    second escalates, and the write ledger's refusal escalates at once; its escalation's four options: accept (F1
 *    again), guidance (D1, its gate, the design gate, F1), verification (dropped) and stop (escalated);
 *  - W1, V4's full pass, the fix round and the re-check, then the final gate: `accept` completes the build,
 *    `accept:verification` too, the verification gate following once the queue is empty, `decline:<note>` ends it
 *    `not-accepted`, `campaign` reopens it for D2, the D2 gate, W1 and V4's campaign pass (`V4-campaign`, a
 *    completed build's), `revise:<text>` is a revision;
 *  - a build that ends hands over to the next queued card, the verification gate an answer asked for, or the run's
 *    end; once it ends, entries come only behind a resume (D-415), whose verification visit takes the next answer;
 *    entries are placed by the lengths each `resumes[]` entry recorded, and a resume offers `guide:<id>` (a file-only
 *    build's guide), `campaign:<id>` (a completed or file-only build's campaign) and `design:<id>` (a stopped or
 *    dropped build's design gate, when its last D1 gate passed);
 *  - a step the permission system refused (outcome `refused`, or a gate verdict with `tool-refused`, D-421) is re-run
 *    next, alone, uncounted, and routes to no producer;
 *  - the run's status: `completed` when any build ended completed or file-only, else the last build's end, or stopped
 *    when no card was finalized; each build's status in builds[] its end, builds[] in finalize order.
 * A migrated run's entries before its first resume (`ctx.legacy`) were recorded by schema 3's pipeline: there a design
 * runs D1-build then D1-finish, and the design gate's `accept` goes to D2 (D-415).
 */
function checkFlow4(log, fail, ctx) {
  if (!Array.isArray(log.stages) || !log.stages.every(isObj)) return;
  const stages = log.stages;
  const escalations = list(log.escalations);
  const checkpoints = list(log.checkpoints);
  const faults = list(log.faults);
  const resumes = list(log.resumes).filter((r) => isObj(r.lengths) && RESUME_LISTS.every((k) => isInt(r.lengths[k])));
  const at = (i) => `run-log.json stages[${i}] (${describe(stages[i])})`;
  const illegal = (i, why) => fail('order', i === undefined ? `run-log.json: ${why}` : `${at(i)}: ${why}`);
  const legacyEnd = ctx.legacy ? ctx.legacy.stages : 0;
  // §22 (amendment 13): where the log's entries start being held to revision 13; a build is held by its last D1 gate.
  const held13 = heldFrom(log, 'stages', A13);
  const legacyAt = (i) => i !== undefined && i < legacyEnd;
  const GATE_NAME = { brainstorm: 'the brainstorm gate', verification: 'the verification gate', design: 'the design gate', final: 'the final gate' };

  // Attempts number every call of a (stage, concept), from 1 (run-log.md), refused calls included.
  const counts = new Map();
  stages.forEach((s, i) => {
    if (ROUND_STAGES.includes(s.stage)) return;
    const key = `${s.stage}|${s.concept}`;
    const want = (counts.get(key) ?? 0) + 1;
    counts.set(key, want);
    if (s.attempt !== want) illegal(i, `is call ${want} of ${s.stage} for ${s.concept}, so its attempt is ${want}; every call counts, re-runs included`);
  });
  // A missing return re-runs once, uncounted, within its block; a second miss of the step ends the run stopped.
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
      if (rerun >= 0) illegal(i, 'is a second missing return of the step, which still re-ran; a second miss ends the run stopped');
      else if (end < stages.length || log.status !== 'stopped') illegal(i, `is a second missing return of the step; the run then ends stopped, naming the step, but it ${end < stages.length ? 'goes on' : `ends ${show(log.status)}`}`);
    } else if (rerun < 0) illegal(i, 'returned without its file and never re-ran; a missing return re-runs once, uncounted');
  });
  // D-421: a refused call (outcome refused, or a gate verdict with tool-refused) re-runs next, alone, once the user
  // allowed the tool; it counts against no cap and routes to no producer.
  const refusedLike = (s) => s.outcome === REFUSED || (['D1-gate', 'D2-gate', 'F1'].includes(s.stage) && toolRefused(ctx.verdict(s)));
  stages.forEach((s, i) => {
    if (!refusedLike(s) || i + 1 >= stages.length) return;
    if (!sameStep(stages[i + 1], s)) illegal(i, `was refused by the permission system${s.outcome === REFUSED ? '' : ` (its verdict's ${TOOL_REFUSED})`}, but ${describe(stages[i + 1])} follows; the runner asks the user to allow the tool and re-runs the refused step alone, next, uncounted (D-421)`);
  });

  // D-429: a run keeps the coordinator step its first brainstorm round used: R1a-assemble's deal for a run that began
  // with it, R1a-synthesize's composites for one that began composing; a run mixing the two fails.
  const roundStep = stages.find((s) => ASSEMBLY_STAGES.includes(s.stage))?.stage;
  stages.forEach((s, i) => {
    if (ASSEMBLY_STAGES.includes(s.stage) && s.stage !== roundStep) illegal(i, `runs ${s.stage}, but this run's first brainstorm round ran ${roundStep}; a run whose first round used R1a-assemble keeps it for every later round, and one that composed keeps R1a-synthesize: the two never mix in one run (D-429)`);
  });

  // The findings accepted so far, per card (D-411): an acceptance covers that build's gate attempts after it.
  const acceptedSoFar = [];
  const coveredSoFar = (concept) => (f) => acceptedSoFar.some((a) => a.concept === concept && a.stage === (f.stage ?? null) && a.part === f.part && a.code === f.code);
  const freeFault = (s) => {
    if (s.attempt !== 1 || s.outcome !== 'fail') return false;
    const rep = ctx.verdict(s);
    const failing = failingFindings(rep, s.stage, coveredSoFar(s.concept));
    return faults.some(
      (f) => ['FI-1', 'FI-2'].includes(f.id) && FAULT_STAGE[f.id] === s.stage && f.target?.persistent !== true && targets(f.target, s.concept) &&
        list(rep?.faultsApplied).some((a) => a.id === f.id) && failing.length > 0 && failing.every((x) => x.stage === ctx.faultedStage(f.id, s.concept)),
    );
  };
  const forcedByFault = (s) => faults.some((f) => f.id === 'FI-3' && targets(f.target, s.concept) && (f.target?.persistent === true || s.attempt === 1));

  // Each gate's answers in checkpoints[] order, with their indices, placed against the resumes (D-415).
  const answers = Object.fromEntries(Object.keys(GATE_NAME).map((g) => [g, checkpoints.map((c, k) => ({ c, k })).filter(({ c }) => c.checkpoint === g)]));
  let seg = 0;
  const hi = () => (seg < resumes.length ? resumes[seg].lengths.checkpoints : Infinity);
  const take = (kind) => {
    const a = answers[kind][0];
    if (!a || a.k >= hi()) return undefined;
    answers[kind].shift();
    return a;
  };

  // The research rounds (schema 3's rules), the rival, and the builds.
  const firstAssembly = stages.findIndex((s) => s.stage === 'R1b-assemble' && s.outcome !== 'missing');
  const afterAssembly = firstAssembly >= 0 ? stages.slice(firstAssembly + 1).find((s) => s.outcome !== 'missing') : undefined;
  const autoRival = afterAssembly?.stage === 'RV' ? afterAssembly : null;
  const rivalIds = rivalCards(stages);
  const atGate = (s) => s.stage === 'Q' || (s.stage === 'RV' && s !== autoRival);
  const steps = stages.map((s, i) => ({ s, i })).filter(({ s }) => !idle(s) && !refusedLike(s) && !atGate(s));
  let round = null;
  let rounds = 0;
  let vround = null;
  let vrounds = 0;
  const r1bSeen = new Map();
  const retriesLeft = (cid) => {
    const r = r1bSeen.get(cid);
    return r !== undefined && !r.passed && !r.terminal && r.counted < R1B_ATTEMPTS;
  };

  /** Each finalized card's build, as the flow sees it (D-412). */
  const B = new Map();
  const buildOf = (id) => {
    if (!B.has(id)) B.set(id, { id, status: 'queued', full: false, verified: false, cycle: null, campaign: null, after: null, d1: null, chains: new Map(), lastD1: null, everCompleted: false, legacy: false, guide: false, toolError: false, claims: null, lastD1At: -1 });
    return B.get(id);
  };
  const finalizeOrder = [];
  const ended = [];
  let queue = [];
  let cur = null;
  let wantVerification = false;
  let runEnded = null; // why the run ended, or null
  let started = null; // the D1-build that just started a design
  const chain = (b, gate) => {
    if (!b.chains.has(gate)) b.chains.set(gate, { counted: 0, guided: false, failed: 0 });
    return b.chains.get(gate);
  };
  const freshChain = (b, gate) => b.chains.set(gate, { counted: 0, guided: false, failed: 0 });
  const endBuild = (b, status) => {
    b.status = status;
    if (['completed', 'file-only'].includes(status)) b.everCompleted = true;
    ended.push({ id: b.id, status });
    if (cur === b) cur = null;
  };
  const newCycle = (start) => ({ start, first: 'none', failed: false, fix: false, recheck: 'none' });
  const cycleDone = (c) => c !== null && c.first === 'done' && (!c.failed || c.recheck === 'done');

  /** The first queued card's design starts at its D1-build (D-411). */
  const startDesign = (s, i) => {
    if (s.stage !== 'D1-build' || s.concept !== queue[0]) {
      illegal(i, `follows a finalize, so the first queued card's design comes next: ${queue[0]}'s D1-build, not ${s.stage}${s.concept ? ` ${s.concept}` : ''} (D-411)`);
      return;
    }
    queue.shift();
    const b = buildOf(s.concept);
    b.status = 'designing';
    b.verified = false;
    b.cycle = null;
    b.after = null;
    b.claims = null;
    freshChain(b, 'D1-gate');
    cur = b;
    started = s;
  };
  /** A build ended: the next queued card's design, the verification gate an answer asked for, or the run's end. */
  const afterBuild = (s, i, why) => {
    cur = null;
    if (queue.length > 0) {
      if (s !== undefined) startDesign(s, i);
      return 'design';
    }
    if (wantVerification) {
      wantVerification = false;
      return followGate('verification', s, i);
    }
    runEnded = why;
    if (s !== undefined) {
      illegal(i, `follows ${why}, which ends the run: no card is queued and no answer asked for the verification gate; entries after it come only behind a resume (D-411, D-415)`);
      runEnded = null;
    }
    return 'end';
  };
  /** Whether a run of the verification gate's resume answers may follow: only after a resume (D-415). */
  const resumedBefore = (k) => resumes.some((r) => r.lengths.checkpoints <= k);

  /**
   * The step after a gate visit follows that visit's answer, the gate's next one in checkpoints[] (D-287, D-411);
   * `s` undefined when no step follows yet. Returns the answer's kind.
   */
  const followGate = (kind, s, i) => {
    const got = take(kind);
    const name = GATE_NAME[kind];
    if (got === undefined) {
      if (s === undefined) return 'waiting';
      if (kind === 'design' && ['D2', 'F1'].includes(s.stage)) fail('design-gate', `${at(i)}: reaches ${s.stage} without a design gate visit: checkpoints[] records no design answer after ${cur?.id ?? s.concept}'s D1 gate; the design gate runs between the D1 gate and the final compile, whoever answers (D-362, D-411)`);
      else illegal(i, `follows a visit of ${name}, but checkpoints[] records no ${kind} answer for it${seg > 0 ? ' after the resume' : ''}; each visit records its answer (D-289)`);
      return undefined;
    }
    const { c, k } = got;
    const a = String(c.answer);
    const where = `checkpoints[${k}] (${kind} visit ${c.visit})`;
    if (['design', 'final'].includes(kind) && cur && c.concept !== undefined && c.concept !== cur.id) fail('order', `run-log.json ${where} names ${c.concept}, but the build at ${name} is ${cur.id}; a ${kind} checkpoint names its build (D-412)`);
    if (a === 'stop') {
      if (['design', 'final'].includes(kind) && cur && c.answeredBy !== 'default') {
        endBuild(cur, 'stopped');
        return afterBuild(s, i, `${name} answered "stop"`);
      }
      // The run stops: the queued cards stop with it (D-411); a default stop is a test config with no answer left.
      if (cur) endBuild(cur, 'stopped');
      for (const id of queue) endBuild(buildOf(id), 'stopped');
      queue = [];
      runEnded = `${name} answered "stop"`;
      if (s !== undefined) {
        illegal(i, `follows ${name} answered "stop", which ends the run stopped; entries after it come only behind a resume (D-415)`);
        runEnded = null;
      }
      return 'stop';
    }
    if (kind === 'design') {
      if (cur === null) {
        illegal(i, `follows ${where}, but no build is at the design gate`);
        return undefined;
      }
      if (a === 'accept' || a === 'accept:file') {
        cur.after = a === 'accept' ? 'guide' : 'file';
        if (s === undefined) return 'accept';
        // D-444 (amendment 11): after a retry-pricing answer at this visit, the D1 gate's re-price pass runs before F1.
        const reprice = list(log.pricing?.retries).some((r) => r.checkpoint === 'design' && r.answer === 'retry-pricing' && r.at === i);
        // D-413: the accepted design goes to F1, the final compile; a migrated run's schema-3 design went to D2.
        const want = legacyAt(i) && a === 'accept' ? ['D2', 'F1'] : reprice ? ['D1-gate', 'F1'] : ['F1'];
        if (!want.includes(s.stage) || s.concept !== cur.id) illegal(i, `follows the design gate answered ${show(a)}, which goes on to ${cur.id}'s final compile, F1${reprice ? ", after the D1 gate's re-price pass the retry-pricing answer asked for (D-444)" : ''}, not ${s.stage}${s.concept ? ` ${s.concept}` : ''} (D-413)`);
        if (reprice && s.stage === 'D1-gate') cur.reprice = true;
        return 'accept';
      }
      if (a.startsWith('revise:')) {
        if (s !== undefined && (!['D1-build', 'D1-tree', 'D1-finish'].includes(s.stage) || s.concept !== cur.id)) illegal(i, `follows the design gate answered ${show(a)}, which runs ${cur.id}'s D1 again (D1-build, D1-tree or D1-finish), not ${s.stage} (D-362, D-418)`);
        return 'revise';
      }
      if (a === 'verification') {
        endBuild(cur, 'dropped');
        return followGate('verification', s, i);
      }
      illegal(i, `follows the design gate answered ${show(a)}, which isn't an answer of that gate`);
      return undefined;
    }
    if (kind === 'final') {
      if (cur === null) {
        illegal(i, `follows ${where}, but no build is at the final gate`);
        return undefined;
      }
      if (a === 'accept' || a === 'accept:verification') {
        if (a === 'accept:verification') wantVerification = true;
        endBuild(cur, 'completed');
        return afterBuild(s, i, `the final gate answered ${show(a)}`);
      }
      if (a.startsWith('decline:')) {
        endBuild(cur, 'not-accepted');
        return afterBuild(s, i, `the final gate answered ${show(a)}`);
      }
      if (a === 'campaign') {
        // D-415: the build ends completed with its endgame guide, then reopens for its campaign: D2 next.
        cur.everCompleted = true;
        ended.push({ id: cur.id, status: 'completed' });
        cur.status = 'writing';
        cur.campaign = 'campaign';
        if (s !== undefined && (s.stage !== 'D2' || s.concept !== cur.id)) illegal(i, `follows the final gate answered "campaign", which reopens ${cur.id} for its campaign: D2 next, after the round copy (D-415)`);
        return 'campaign';
      }
      if (a.startsWith('revise:')) {
        if (s !== undefined && (!['D1-finish', 'D2', 'W1'].includes(s.stage) || s.concept !== cur.id)) illegal(i, `follows the final gate answered ${show(a)}, a revision, whose owners are D1 (D1-finish first), D2 and W1 for ${cur.id}, not ${s.stage} (D-236, D-352)`);
        return 'revise';
      }
      illegal(i, `follows the final gate answered ${show(a)}, which isn't an answer of that gate`);
      return undefined;
    }
    if (a === 'more') {
      if (s !== undefined && s.stage !== 'R1a') illegal(i, `follows ${name} answered "more", which starts a brainstorm round (R1a), not ${s.stage}`);
      return 'more';
    }
    const m = /^(pick|verify):(.*)$/s.exec(a);
    if (m && ((kind === 'brainstorm' && m[1] === 'pick') || (kind === 'verification' && m[1] === 'verify'))) {
      const ids = m[2].split(',').filter((x) => x !== '');
      for (const id of ids) if (!ctx.cardExists(id)) fail('deck', `run-log.json checkpoints: ${name} answered ${show(a)}, but ${id} is no card of the run (cards/${id}.md, C-52)`);
      const made = list(c.newCards).map((n) => n.id);
      const shown = made.length > 0 ? `${show(a)} with the new card(s) ${made.join(', ')}` : show(a);
      if (s !== undefined && s.stage !== 'R1b') illegal(i, `follows ${name} answered ${shown}, which starts a verification round (R1b), not ${s.stage}`);
      vrounds += 1;
      vround = { n: vrounds, gate: `${name}'s ${shown}`, expected: [...ids, ...made], cards: [] };
      return 'verify';
    }
    if (m && kind === 'verification' && m[1] === 'pick') {
      // D-411: 1–3 cards finalized, in the user's order, ahead of the cards still queued.
      const ids = m[2].split(',').filter((x) => x !== '');
      for (const id of ids) {
        const r = r1bSeen.get(id);
        if (r === undefined) illegal(i, `follows the verification gate answered ${show(a)}, but no R1b verified ${id} in the run; the gate finalizes a verified card (D-287)`);
        else if (r.terminal === 'not-a-skill') illegal(i, `follows the verification gate answered ${show(a)}, but ${id}'s damage source isn't a skill (its R1b ended not-a-skill), so it can't be finalized yet (D-303, D-334)`);
        else if (r.terminal === 'wrong-ascendancy') illegal(i, `follows the verification gate answered ${show(a)}, but ${id}'s ascendancy doesn't own the passive-tree node that grants its skill (its R1b ended wrong-ascendancy), so it can't be finalized (D-342)`);
        else if (r.terminal === 'not-in-pin') illegal(i, `follows the verification gate answered ${show(a)}, but ${id} rests on an entry the PoB pin doesn't know (its R1b ended not-in-pin), so it can't be finalized yet (D-303, D-400)`);
        else if (r.terminal === 'not-dealt') illegal(i, `follows the verification gate answered ${show(a)}, but ${id}, the rival's card, failed R1a-assemble's identity and sniff checks (its R1b ended not-dealt), so it can't be finalized (D-408)`);
        if (B.has(id) && !legacyAt(i)) illegal(i, `follows the verification gate answered ${show(a)}, but ${id} already has a build (${B.get(id).status}); a second design of it is a revise at its design gate, or a new card made from it (D-411)`);
        const b = buildOf(id);
        b.status = 'queued';
        b.legacy = legacyAt(i);
        if (!finalizeOrder.includes(id)) finalizeOrder.push(id);
      }
      queue = [...ids, ...queue.filter((id) => !ids.includes(id))];
      if (s !== undefined) startDesign(s, i);
      return 'pick';
    }
    const r = kind === 'verification' ? RESUME_ANSWER.exec(a) : null;
    if (r) {
      // D-415: a resume's answers, each about one build of the run.
      const b = B.get(r[2]);
      const want = { guide: ['file-only'], campaign: ['completed', 'file-only'], design: ['stopped', 'dropped'] }[r[1]];
      if (!resumedBefore(k)) illegal(i, `follows the verification gate answered ${show(a)}, an answer a resume offers, but no resume precedes ${where} (D-415)`);
      if (!b) {
        illegal(i, `follows the verification gate answered ${show(a)}, but ${r[2]} has no build in the run (D-415)`);
        return undefined;
      }
      if (!want.includes(b.status)) illegal(i, `follows the verification gate answered ${show(a)}, but ${r[2]} is ${b.status}; ${r[1]}:<id> takes a ${want.join(' or ')} build (D-415)`);
      cur = b;
      // D-477: a claims pass belongs to the file-only build it ended; a resume's guide, campaign or design starts afresh.
      b.claims = null;
      if (r[1] === 'guide') {
        b.status = 'writing';
        b.campaign = null;
        if (s !== undefined && (s.stage !== 'W1' || s.concept !== b.id)) illegal(i, `follows the verification gate answered ${show(a)}, which writes ${b.id}'s endgame guide: W1 next (D-415)`);
        return 'guide';
      }
      if (r[1] === 'campaign') {
        b.campaign = b.status === 'completed' ? 'campaign' : 'full';
        b.status = 'writing';
        if (s !== undefined && (s.stage !== 'D2' || s.concept !== b.id)) illegal(i, `follows the verification gate answered ${show(a)}, which adds ${b.id}'s campaign: D2 next${b.campaign === 'campaign' ? ', after the round copy' : ''} (D-415)`);
        return 'campaign';
      }
      // design:<id>: its design gate again, from the existing verdict file, when its last D1 gate passed.
      if (!b.lastD1) illegal(i, `follows the verification gate answered ${show(a)}, but ${b.id}'s last D1 gate didn't pass; design:<id> shows the design gate of a build whose last D1 gate passed on its current plan (D-415)`);
      b.status = 'designing';
      b.verified = false;
      return followGate('design', s, i);
    }
    illegal(i, `follows ${name} answered ${show(a)}, which isn't an answer of that gate`);
    return undefined;
  };

  /** What follows a step: a gate, a build's end, an escalation's choice, or SKILL.md's step list. */
  let lastEscalation = null;
  const transition = (p, s) => {
    if (!p) return { table: true };
    const b = typeof p.concept === 'string' ? B.get(p.concept) : undefined;
    // D-429: a brainstorm round ends at its coordinator step, R1a-assemble's deal or R1a-synthesize's composites.
    if (ASSEMBLY_STAGES.includes(p.stage) && s?.stage !== p.stage) return { gate: 'brainstorm' };
    if (p.stage === 'R1b-assemble') return s !== undefined && s === autoRival ? { table: true } : { gate: 'verification' };
    if (p.stage === 'RV' && p.outcome === 'none-found') return { gate: 'verification' };
    if (p.stage === 'D1-gate' && p.outcome === 'infeasible') return { gate: 'verification' };
    if (p.outcome === 'escalated') {
      const choice = lastEscalation?.choice;
      if (choice === 'verification') return { gate: 'verification' };
      if (choice === 'stop') return { end: `${p.stage} ${p.concept}'s escalation answered stop` };
      if (choice === 'accept' && p.stage === 'D1-gate' && b && !b.verified) return { gate: 'design' };
      return { escalation: choice };
    }
    // D-444: the D1 gate's re-price pass after the design gate's accept and a retry-pricing goes on to F1, not the gate.
    if (p.stage === 'D1-gate' && p.outcome === 'pass' && b && !b.verified && !b.reprice) return { gate: 'design' };
    if (p.stage === 'F1' && p.outcome === 'pass' && b && b.status === 'file-only') return { end: `${p.concept}'s F1 passed after the design gate's accept:file, which ends the build file-only` };
    // D-477 (amendment 13): a file-only build held to revision 13 ends after its claims pass, or the re-check of its round.
    if (['V4-claims', 'V4-recheck'].includes(p.stage) && b && b.claims?.state === 'ended' && b.status === 'file-only') return { end: `${p.concept}'s ${p.stage === 'V4-claims' ? 'claims pass' : "claims pass's re-check"}, which ends the build file-only (D-477)` };
    if (V4_STAGES.includes(p.stage) && b && cycleDone(b.cycle)) return { gate: 'final' };
    return { table: true };
  };

  let prev = null;
  let esc = 0;
  /** A resume (D-415): what the step before it led to settles with no step after it, then its verification visit. */
  let resumeVisit = false;
  const settle = () => {
    if (resumeVisit) {
      resumeVisit = false;
      followGate('verification', undefined, undefined);
      return;
    }
    const p = prev?.s;
    if (!p) return;
    const t = transition(p, undefined);
    if (t.gate) followGate(t.gate, undefined, undefined);
    else if (t.end) afterBuild(undefined, undefined, t.end);
  };
  const openResume = (r, n) => {
    for (const kind of Object.keys(answers)) {
      while (answers[kind].length > 0 && answers[kind][0].k < r.lengths.checkpoints) {
        const { c, k } = answers[kind].shift();
        fail('order', `run-log.json checkpoints[${k}] (${kind} visit ${c.visit}) is recorded before resumes[${n}] (at checkpoints[${r.lengths.checkpoints}]), but no step before the resume follows it; entries are placed by the resume's recorded lengths (D-415)`);
      }
    }
    if (esc < escalations.length && esc > r.lengths.escalations) fail('order', `run-log.json resumes[${n}] records ${r.lengths.escalations} escalation(s), but ${esc} were logged before it (D-415)`);
    runEnded = null;
    // D-415: the resume prints the verification gate's display; a build in progress waits there with the queue.
    if (cur && !['queued', 'designing', 'writing'].includes(cur.status)) cur = null;
    resumeVisit = true;
  };

  for (const { s, i } of steps) {
    const f = familyOf(s);
    // The resumes recorded before this step: what the last step led to settles, then each resume's visit.
    while (seg < resumes.length && resumes[seg].lengths.stages <= i) {
      settle();
      openResume(resumes[seg], seg);
      seg += 1;
    }
    const p = prev?.s;
    const pf = p ? familyOf(p) : 'start';
    const same = p !== undefined && p.concept === s.concept;
    const postVerify = ['V4', 'V4r', 'V4c', 'V4k'].includes(pf) && !resumeVisit;
    started = null;
    let via = null;
    if (runEnded !== null && !resumeVisit) {
      illegal(i, `follows ${runEnded}, which ended the run; entries after it come only behind a resume (D-415)`);
      runEnded = null;
    }
    if (resumeVisit) {
      resumeVisit = false;
      via = followGate('verification', s, i) ?? null;
    } else {
      const t = transition(p, s);
      if (t.gate) via = followGate(t.gate, s, i) ?? null;
      else if (t.end) via = afterBuild(s, i, t.end);
      else if (t.escalation !== undefined) {
        const choice = t.escalation;
        const b = buildOf(p.concept);
        const ok = !same ? false
          : choice === 'accept' ? (p.stage === 'D1-gate' ? (b.full ? ['D2', 'D2-gate'] : ['F1']).includes(s.stage) : s.stage === p.stage)
            : choice === 'retry' ? (p.stage === 'D1-gate' ? ['D1-build', 'D1-tree'] : p.stage === 'D2-gate' ? ['D2'] : ['D1-build', 'D1-tree', 'D1-finish']).includes(s.stage)
              : false;
        if (!ok) illegal(i, `follows ${p.stage} ${p.concept}'s escalation answered ${show(choice)}, which doesn't lead to ${s.stage}${s.concept ? ` ${s.concept}` : ''} (D-236${p.stage === 'F1' ? ', D-413' : ''})`);
      } else {
        const b = typeof p?.concept === 'string' ? B.get(p.concept) : undefined;
        const cls = p && ['D1-gate', 'D2-gate', 'F1'].includes(p.stage) && isObj(ctx.verdict(p)?.verdict) ? gateClass4(ctx.verdict(p), p.stage, coveredSoFar(p.concept)) : null;
        const owners = ['D1-finish', 'D2', 'W1'];
        const nextCheck = b?.cycle ? (b.cycle.first === 'done' ? (b.cycle.fix ? 'V4r' : 'V4') : b.cycle.start === 'revision' ? 'V4r' : b.cycle.start === 'campaign' ? 'V4c' : 'V4') : 'V4';
        const legacy = legacyAt(prev?.i);
        const routes = {
          start: ['R1a'],
          R1a: ['R1a', 'R1a-assemble', 'R1a-synthesize'],
          'R1a-assemble': ['R1a-assemble'],
          'R1a-synthesize': ['R1a-synthesize'],
          R1b: ['R1b', 'R1b-assemble'],
          'R1b-assemble': ['RV'],
          RV: p?.outcome === 'done' ? ['R1b'] : [],
          // D-418: D1-build, then D1-tree; a schema-3 design (a migrated run's) and a D1-build claiming infeasible may
          // go on to D1-finish.
          'D1-build': legacy ? ['D1-finish'] : p?.outcome === 'infeasible' ? ['D1-tree', 'D1-finish'] : ['D1-tree'],
          // D-438 (amendment 11): D1-tree's `respec` (a scaling change D1-build missed) routes D1-build next, and §14:
          // D1-finish's `build` (its return `build: <ids>`) routes D1-build next, both in the same attempt.
          'D1-tree': p?.outcome === 'respec' ? ['D1-build'] : ['D1-finish'],
          // D-477: a claims-only edit in a file-only build's claims round goes to its re-check.
          'D1-finish': p?.outcome === CLAIMS_EDITED ? (b?.claims?.fix ? ['V4r'] : ['D2', 'W1']) : p?.outcome === 'build' ? ['D1-build'] : b?.d1 && !b.d1.built ? ['D1-gate', 'D1-build', 'D1-tree'] : ['D1-gate'],
          'D1-gate': p?.outcome === 'pass' ? (b?.full ? ['D2', 'D2-gate'] : ['F1'])
            : p?.outcome === 'fail' ? (cls === 'tree' ? ['D1-tree'] : cls === 'toolError' ? ['D1-gate'] : ['D1-build']) : [],
          D2: p?.outcome === CLAIMS_EDITED ? ['W1'] : ['D2-gate'],
          'D2-gate': p?.outcome === 'pass' ? ['W1'] : ['D2'],
          // D-477: a file-only build held to revision 13 has its claims pass after F1, and its re-check after a recompile.
          F1: p?.outcome === 'pass' ? (b?.claims?.state === 'want' ? ['V4k'] : b?.claims?.fix ? ['V4r'] : ['W1']) : ['F1'],
          V4k: p?.outcome === 'fail' ? ['D1-finish'] : [],
          W1: [nextCheck],
          V4: ['V4', ...owners],
          V4r: ['V4r', ...owners],
          V4c: ['V4c', ...owners],
        }[pf] ?? [];
        // D-467 (amendment 13): D1-tree's `stale-server`, D1-tree again once the user reconnected the server with /mcp.
        const allowed = pf === 'D1-tree' && p?.outcome === STALE_SERVER ? ['D1-tree'] : routes;
        if (!allowed.includes(f)) illegal(i, `can't follow ${p ? describe(p) : 'the start'} (outcome ${show(p?.outcome)}${cls && cls !== 'pass' ? `; its verdict ${describeClass4(cls)}` : ''}); SKILL.md's step list allows ${allowed.join(', ').replace(/\bV4r\b/g, 'V4-recheck').replace(/\bV4c\b/g, 'V4-campaign') || 'nothing'} next`);
        const keepsConcept = [...D1_STAGES, 'D1-gate', 'D2', 'D2-gate', 'F1', 'W1', 'V4', 'V4r', 'V4c', 'V4k'].includes(pf);
        if (keepsConcept && p && !ROUND_STAGES.includes(s.stage) && !same) illegal(i, `is about ${s.concept}, but the build before it is ${p.concept}'s; a build's steps run for its own card until it ends (D-411)`);
      }
    }
    // D-264: a claims-only owner edits in place before any gate of its fix round or revision.
    if (s.outcome === CLAIMS_EDITED && !((postVerify && s.stage !== 'D1-build') || (s.stage === 'D2' && pf === 'D1-finish' && p?.outcome === CLAIMS_EDITED))) {
      illegal(i, `edits claims without a compile (${CLAIMS_EDITED}), which an owner does only in the fix round or a revision, before any gate of it re-runs (D-264)`);
    }

    // Brainstorm rounds (D-287, NFR-23).
    if (s.stage === 'R1a' && pf !== 'R1a') {
      rounds += 1;
      round = { n: rounds, r1a: 0, assembles: 0 };
    }
    if (s.stage === 'R1a' && round) {
      round.r1a += 1;
      if (round.r1a > ROUND_CAP) fail('caps', `${at(i)}: brainstorm round ${round.n} runs ${round.r1a} R1a researchers; at most ${ROUND_CAP} (NFR-23)`);
    }
    if (ASSEMBLY_STAGES.includes(s.stage) && round) {
      round.assembles += 1;
      if (round.assembles > 1) fail('caps', `${at(i)}: brainstorm round ${round.n} runs ${round.assembles} ${s.stage} steps; one ${s.stage === 'R1a-synthesize' ? "composes the round's builds (D-429" : "deals the round's deck (D-287"}, NFR-23)`);
    }
    if (s.stage === 'R1b') {
      const seen = r1bSeen.get(s.concept);
      if (vround === null) illegal(i, `runs R1b for ${s.concept} outside a verification round; only a gate's pick:<ids> or verify:<ids> opens one`);
      else {
        if (seen && seen.round !== vround.n) illegal(i, `verifies ${s.concept} again in verification round ${vround.n}; a card is verified once, and "verify other cards" picks cards not verified yet (D-287)`);
        if (!vround.cards.includes(s.concept)) {
          const next = vround.expected[vround.cards.length];
          if (!vround.expected.includes(s.concept)) illegal(i, `runs R1b for ${s.concept}, which ${vround.gate} didn't pick for verification round ${vround.n}`);
          else if (next !== s.concept) illegal(i, `verifies ${s.concept} before ${next}; R1b runs the picked cards in the order picked (${vround.expected.join(', ')})`);
          vround.cards.push(s.concept);
          const capped = vround.cards.filter((x) => !RIVAL_CARD.test(x)).length;
          if (!RIVAL_CARD.test(s.concept) && capped > ROUND_CAP) fail('caps', `${at(i)}: verification round ${vround.n} compiles ${capped} cards; at most ${ROUND_CAP} per verification round (D-287, NFR-23), the rival's aside (D-408)`);
        }
      }
      const r = seen ?? { round: vround?.n, counted: 0, passed: false, terminal: null };
      r1bSeen.set(s.concept, r);
      if (r.terminal) illegal(i, `runs R1b for ${s.concept} again, but its last attempt ended ${r.terminal} with no compile, which no retry changes (D-334, D-342, D-400, D-408)`);
      else if (r.passed) illegal(i, `runs R1b for ${s.concept} after it compiled`);
      else if (r.counted >= R1B_ATTEMPTS) fail('caps', `${at(i)}: is a counted R1b attempt for ${s.concept} after ${r.counted}; R1b allows 2 counted retries, then the card is failed (Q2)`);
      if (p && p.stage === 'R1b' && p.outcome === 'fail' && p.concept !== s.concept && retriesLeft(p.concept)) illegal(i, `R1b ${p.concept} failed with retries left, but the next R1b is ${s.concept}'s; a failed compile re-runs first`);
      if (s.outcome === 'pass') r.passed = true;
      const terminal = ctx.terminal(s);
      if (terminal) r.terminal = terminal;
      if (s.outcome === 'pass' || !freeFault(s)) r.counted += 1;
    }
    if (s.stage === 'R1b-assemble') {
      if (p?.stage === 'R1b' && p.outcome === 'fail' && retriesLeft(p.concept)) illegal(i, `R1b ${p.concept} failed with retries left, but the round assembles; a failed compile re-runs first`);
      if (vround !== null) {
        const left = vround.expected.filter((x) => !vround.cards.includes(x));
        if (left.length > 0) illegal(i, `assembles verification round ${vround.n}, but no R1b ran for ${left.join(', ')}, which ${vround.gate} picked`);
        vround = null;
      }
    }
    if (s === autoRival && s.outcome === 'done') vround = { n: vrounds, gate: "the rival's step (RV, D-408)", expected: [rivalIds.get(s)], cards: [] };

    // Builds: their designs, final compiles, guides and checks (D-411…D-415).
    if (BUILD_STEPS.includes(s.stage) && typeof s.concept === 'string' && !B.has(s.concept)) illegal(i, `is about ${s.concept}, which no verification gate finalized (D-411)`);
    const b = BUILD_STEPS.includes(s.stage) && typeof s.concept === 'string' ? buildOf(s.concept) : null;
    /** A step about a build after its V4 checks: the fix round when the last check found something, else a revision. */
    const afterVerification = () => {
      if (b.cycle === null) {
        illegal(i, 'follows the V4 checks of another build');
        return;
      }
      if (b.cycle.first === 'done' && b.cycle.failed && !b.cycle.fix) b.cycle.fix = true;
      else b.cycle = newCycle('revision');
      b.verified = true;
    };
    if (b && D1_STAGES.includes(s.stage)) {
      const continues = same && p && ((s.stage === 'D1-tree' && p.stage === 'D1-build') || (s.stage === 'D1-tree' && p.stage === 'D1-tree' && p.outcome === STALE_SERVER) || (s.stage === 'D1-finish' && ['D1-build', 'D1-tree'].includes(p.stage))
        || (['D1-build', 'D1-tree'].includes(s.stage) && p.stage === 'D1-finish' && p.outcome === 'done' && b.d1 && !b.d1.built)
        // D-438, §14: D1-build after D1-tree's `respec` or D1-finish's `build`, in the same attempt, even after its D1-build.
        || (s.stage === 'D1-build' && ((p.stage === 'D1-tree' && p.outcome === 'respec') || (p.stage === 'D1-finish' && p.outcome === 'build'))));
      if (!continues) {
        b.d1 = { built: false, infeasible: false };
        if (pf === 'D1-gate' && p.outcome === 'fail' && same) {
          // a counted retry (or a free one, or a tool's re-run)
        } else if (pf === 'D1-gate' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
          chain(b, 'D1-gate').guided = true;
        } else if (pf === 'F1' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
          // D-413: guidance after F1: D1, its gate and the design gate again, then F1 once more, escalating on failure.
          freshChain(b, 'D1-gate');
          b.f1Guided = true;
          b.verified = false;
        } else if (pf === 'V4k' && b.claims !== null) {
          // D-477: the claims pass's fix round, D1 its one owner, no design gate: a recompile runs the D1 gate and F1.
          b.claims.fix = true;
          b.verified = true;
          freshChain(b, 'D1-gate');
        } else if (postVerify && via !== 'campaign') {
          afterVerification();
          freshChain(b, 'D1-gate');
        } else if (via === 'revise') {
          freshChain(b, 'D1-gate');
        }
      }
      if (s.stage === 'D1-build' || s.stage === 'D1-tree') b.d1.built = true;
      if (s.stage === 'D1-build' && s.outcome === 'infeasible') b.d1.infeasible = true;
    }
    if (b && s.stage === 'D2') {
      b.full = true;
      if (pf === 'D2-gate' && p.outcome === 'fail' && same) {
        // a retry
      } else if (pf === 'D2-gate' && p.outcome === 'escalated' && same && lastEscalation?.choice === 'retry') {
        chain(b, 'D2-gate').guided = true;
      } else {
        if (postVerify && via !== 'campaign') afterVerification();
        freshChain(b, 'D2-gate');
      }
    }
    if (b && s.stage === 'D2-gate' && pf === 'D1-gate') freshChain(b, 'D2-gate');
    // F1's chain starts at the design gate's accept, or a fix round's D1 gate; after an F1 escalation's guidance its
    // next failure escalates again (D-413).
    if (b && s.stage === 'F1' && (pf === 'D1-gate' || via === 'accept')) {
      freshChain(b, 'F1');
      chain(b, 'F1').guided = b.f1Guided === true;
      b.f1Guided = false;
    }
    if (b && ['D2-gate', 'F1'].includes(s.stage) && pf === s.stage && p.outcome === 'escalated' && lastEscalation?.choice === 'accept') chain(b, s.stage).guided = true;
    if (b && s.stage === 'W1') {
      if (postVerify && via !== 'guide') afterVerification();
      // A guide's first W1: after the final compile (F1, or the D2 gate), or a resume's guide:<id> (D-415).
      if ((FINAL_GATES.includes(pf) && b.cycle === null) || (pf === 'D2-gate' && b.campaign !== null) || via === 'guide') {
        b.cycle = newCycle(b.campaign === 'campaign' && pf === 'D2-gate' ? 'campaign' : 'full');
        b.campaign = null;
        b.status = 'writing';
      }
      b.guide = true;
    }

    // Each gate attempt routes as its own verdict file says (gates.md's outcome tables, amendment 9's).
    if (['D1-gate', 'D2-gate', 'F1', 'R1b'].includes(s.stage)) {
      const rep = ctx.verdict(s);
      const file = `reports/gates/${s.stage}-${s.concept}-a${s.attempt}.json`;
      const ch = s.stage !== 'R1b' ? chain(b, s.stage) : null;
      if (!isObj(rep) || !isObj(rep.verdict)) fail('routing', `${at(i)}: has no verdict file ${file}; a gate step writes its own, and the runner routes on it (§3)`);
      else if (s.stage === 'R1b') {
        const cls = gateClass(rep, 'R1b', () => false);
        if ((s.outcome === 'pass') !== (cls === 'pass')) fail('routing', `${at(i)}: is routed ${s.outcome}, but its verdict ${describeClass(cls)} (${file})`);
      } else {
        const cls = gateClass4(rep, s.stage, coveredSoFar(s.concept));
        const claimedInfeasible = s.stage === 'D1-gate' && b.d1?.infeasible === true;
        const toolAgain = s.stage === 'D1-gate' && cls === 'toolError' && b.toolError;
        const why = {
          pass: cls === 'pass' ? null : `its verdict ${describeClass4(cls)}, which isn't a pass`,
          fail: s.stage === 'F1' ? (cls === 'hard' ? (ch.guided || ch.failed >= 1 ? 'F1 re-runs once, uncounted, and a second failure (or one after a guided retry or an accepted re-run) escalates (D-413)' : null) : cls === 'ledger' ? "the write ledger's refusal escalates at once: no retry changes it (D-413)" : `its verdict ${describeClass4(cls)}, which isn't a failure`)
            : ['hard', 'soft', 'tree'].includes(cls) ? (ch.guided ? 'a guided retry or an accepted re-run that fails escalates again' : null)
              : cls === 'toolError' ? (toolAgain ? 'a second tool failure escalates (D-419)' : null) : `its verdict ${describeClass4(cls)}, which isn't a failure`,
          escalated: s.stage === 'F1' ? (cls === 'ledger' || (cls === 'hard' && (ch.failed >= 1 || ch.guided)) ? null : `its verdict ${describeClass4(cls)}; F1 escalates on its second failure, or at once on the write ledger's refusal (D-413)`)
            : cls === 'hard' || cls === 'tree' || (ch.guided && cls === 'soft') || toolAgain ? null : `its verdict ${describeClass4(cls)}; only a compile, V1, V2 or tree failure escalates, a second tool failure, or any failure of a guided retry`,
          infeasible: s.stage !== 'D1-gate' ? 'only the D1 gate is infeasible'
            : cls === 'forced' ? (forcedByFault(s) ? null : 'its verdict is forced infeasible, but no FI-3 directive targets this attempt')
              : cls !== 'soft' ? `its verdict ${describeClass4(cls)}; infeasible is FI-3's forced verdict, or a floor or named-damage-source (rolledSkill) failure (the budget never fails, D-371)`
                : ch.guided ? 'a guided retry that fails escalates again'
                  : claimedInfeasible || ch.counted >= GATE_RETRIES ? null : `D1-build claimed done and the gate has ${ch.counted} counted retr${ch.counted === 1 ? 'y' : 'ies'}; a floor or named-damage-source (rolledSkill) failure re-runs D1 until its 2 counted retries, unless D1-build claimed infeasible`,
        }[s.outcome];
        if (cls === 'forced' && s.outcome !== 'infeasible') fail('routing', `${at(i)}: is routed ${s.outcome}, but ${file} is forced infeasible (FI-3)`);
        else if (why) fail('routing', `${at(i)}: is routed ${s.outcome}, but ${why} (${file})`);
        if (s.stage === 'D1-gate') b.toolError = cls === 'toolError';
        // Counted failures and the escalation caps.
        if (s.outcome === 'fail' && s.stage !== 'F1' && cls !== 'toolError' && !freeFault(s)) {
          if (ch.guided) fail('caps', `${at(i)}: fails after a guided retry or an accepted re-run, and the producer re-runs; such a failure escalates again (D-236)`);
          ch.counted += 1;
          if (ch.counted > GATE_RETRIES) fail('caps', `${at(i)}: is counted failure ${ch.counted} of ${s.stage} for ${s.concept} in one chain, and the producer re-runs again; a gate allows ${GATE_RETRIES} counted retries, then escalates (S6: only an attempt-1 fault's failure is free)`);
        }
        if (s.outcome === 'fail' && s.stage === 'F1') ch.failed += 1;
        if (s.outcome === 'escalated' && s.stage !== 'F1' && !ch.guided && ch.counted < GATE_RETRIES && !toolAgain) {
          fail('caps', `${at(i)}: escalates after ${ch.counted} counted retr${ch.counted === 1 ? 'y' : 'ies'}; a gate escalates only after its ${GATE_RETRIES} counted retries, when a guided retry fails again, or on a second tool failure`);
        }
      }
      if (s.stage === 'D1-gate') b.lastD1 = s.outcome === 'pass';
      if (s.stage === 'D1-gate') b.lastD1At = i;
      // D-444: a re-price pass that doesn't pass returns the build to its design's usual route.
      if (s.stage === 'D1-gate' && s.outcome !== 'pass') b.reprice = false;
      if (s.stage === 'F1') b.reprice = false;
      if (s.stage === 'D1-gate' && s.outcome === 'infeasible') endBuild(b, 'dropped');
      // D-477 (amendment 13): a file-only build held to revision 13 (its last D1 gate at or after 13's boundary) doesn't end
      // at F1's pass: it stays designing through its claims pass, V4-claims, and that pass's round.
      if (s.stage === 'F1' && s.outcome === 'pass' && b.after === 'file' && !b.verified) {
        if (b.lastD1At >= held13) b.claims = { state: 'want', fix: false, recheck: false };
        else endBuild(b, 'file-only');
      }
      if (s.stage === 'F1' && s.outcome === 'pass' && !(b.after === 'file' && !b.verified) && b.claims === null) b.status = 'writing';
    }
    if (s.outcome === 'escalated') {
      const e = escalations[esc];
      esc += 1;
      lastEscalation = e ?? null;
      if (!e) fail('escalation', `${at(i)}: escalated, but escalations[] has no entry ${esc - 1} for it`);
      else if (e.stage !== s.stage || e.concept !== s.concept) fail('escalation', `${at(i)}: escalated, but escalations[${esc - 1}] is ${e.stage} ${e.concept}'s; the escalations are logged in stages[] order`);
      else if (!e.verdict?.endsWith?.(`-a${s.attempt}.json`)) fail('escalation', `${at(i)}: escalated, but escalations[${esc - 1}].verdict ${show(e.verdict)} isn't this attempt's verdict file`);
      if (e?.choice === 'accept' && !(s.stage === 'F1' && ledgerRefused(ctx.verdict(s)))) {
        for (const x of failingFindings(ctx.verdict(s), s.stage, coveredSoFar(s.concept))) acceptedSoFar.push({ concept: s.concept, stage: typeof x.stage === 'string' ? x.stage : null, part: x.part, code: x.code });
      }
      if (e?.choice === 'accept' && s.stage === 'D1-gate') b.lastD1 = true;
      if (e?.choice === 'verification') endBuild(b, 'dropped');
      if (e?.choice === 'stop') endBuild(b, 'escalated');
    }

    // The V4 checks (D-352, D-415), per build.
    if (b && f === 'V4') {
      if (b.cycle === null) illegal(i, 'runs a V4 pass with no guide written for this build');
      else if (b.cycle.start === 'revision') fail('verification', `${at(i)}: runs a full V4 pass after a revision; a revision runs no full pass, its owners' changes get a re-check (V4-recheck) of what check-run.mjs --changed lists (D-352)`);
      else if (b.cycle.start === 'campaign') fail('verification', `${at(i)}: runs a full V4 pass after a completed build's campaign; the campaign gets V4's campaign pass, V4-campaign (D-415)`);
      else if (b.cycle.first === 'done') fail('verification', `${at(i)}: starts a second full V4 pass for one guide; after the fix round a re-check (V4-recheck) covers what changed, and a revision the final gate asked for checks with a re-check too (D-352)`);
      else {
        b.cycle.first = 'done';
        b.cycle.failed = s.outcome === 'fail';
      }
    }
    if (b && f === 'V4c') {
      if (b.cycle === null || b.cycle.start !== 'campaign' || b.cycle.first !== 'none') fail('verification', `${at(i)}: runs V4's campaign pass, which checks a completed build's campaign once, after its W1 (D-415)`);
      else {
        b.cycle.first = 'done';
        b.cycle.failed = s.outcome === 'fail';
      }
    }
    // D-477 (amendment 13): a file-only build's claims pass, once, after F1's pass; it ends the build on a pass, and on a
    // failure its fix round (the round copy, D1, and the D1 gate and F1 after a recompile) and its re-check follow.
    if (b && f === 'V4k') {
      if (b.claims === null || b.claims.state !== 'want') fail('verification', `${at(i)}: runs a claims pass (V4-claims), which a file-only build held to amendment 13 runs once, after F1's pass following the design gate's accept:file; a build accepted with its guide, or one whose guide W1 wrote, gets V4's full pass instead (D-477)`);
      else if (s.outcome === 'pass') {
        b.claims.state = 'ended';
        endBuild(b, 'file-only');
      } else b.claims.state = 'failed';
    }
    if (b && f === 'V4r' && b.claims !== null) {
      if (!b.claims.fix || b.claims.recheck) fail('verification', `${at(i)}: re-checks a file-only build's claims pass ${b.claims.recheck ? 'a second time; there is no further round' : 'with no fix round before it'} (D-477)`);
      else {
        b.claims.recheck = true;
        b.claims.state = 'ended';
        endBuild(b, 'file-only');
      }
    } else if (b && f === 'V4r') {
      const c = b.cycle;
      if (c !== null && c.start === 'revision' && c.first === 'none') {
        c.first = 'done';
        c.failed = s.outcome === 'fail';
      } else if (!c || c.first !== 'done' || !c.fix) fail('verification', `${at(i)}: re-checks with no fix round or revision before it; a re-check follows the owners of a fix round (after a check that found something) or of a revision (D-352)`);
      else if (c.recheck === 'done') fail('verification', `${at(i)}: starts a second re-check after one fix round; there is no further round, what stays open is a known issue (D-352)`);
      else c.recheck = 'done';
    }
    prev = { s, i };
  }

  // The resumes after the last step, then what the last step leads to (D-415).
  while (seg < resumes.length) {
    settle();
    openResume(resumes[seg], seg);
    seg += 1;
  }
  settle();
  for (const kind of Object.keys(answers)) {
    if (answers[kind].length > 0) fail('order', `run-log.json: checkpoints[] records ${answers[kind].length} ${kind} answer(s) more than the run visits ${GATE_NAME[kind]}; each visit records one answer, in order (D-289)`);
  }
  if (esc !== escalations.length) fail('escalation', `run-log.json escalations[] has ${escalations.length} entr${escalations.length === 1 ? 'y' : 'ies'}, but stages[] logs ${esc} escalated gate attempt(s); every escalation is logged once, in order`);
  const asked = checkpoints.filter((c) => c.checkpoint === 'escalation');
  escalations.forEach((e, k) => {
    const c = asked[k];
    const want = e.choice === 'retry' ? `retry:${e.guidance}` : e.choice;
    if (c === undefined) fail('escalation', `run-log.json escalations[${k}] (${e.stage} ${e.concept}) has no escalation answer: checkpoints[] records ${asked.length} escalation question(s); each escalation records its question's answer as checkpoint "escalation", in order (checkpoints.md)`);
    else if (c.answer !== want) fail('escalation', `run-log.json escalations[${k}] logs the choice ${show(e.choice)}${e.choice === 'retry' ? ` with guidance ${show(e.guidance)}` : ''}, but checkpoints[${checkpoints.indexOf(c)}], escalation answer ${k + 1}, is ${show(c.answer)}; the choice is the answer, and retry:<guidance> is retry with that guidance (checkpoints.md)`);
  });
  if (asked.length > escalations.length) fail('escalation', `run-log.json checkpoints[] records ${asked.length} escalation answer(s), but escalations[] has ${escalations.length} entr${escalations.length === 1 ? 'y' : 'ies'}; each answer is an escalation's, logged in escalations[] in order (checkpoints.md)`);

  // The run's end (D-411): completed when any build ended completed or file-only, else the last build's end
  // (a dropped build's visit stops it), or stopped when no card was finalized; a run with a step to come is running.
  const any = [...B.values()].some((x) => x.everCompleted);
  const last = ended[ended.length - 1]?.status;
  const ends = any ? 'completed' : last === undefined || last === 'dropped' ? 'stopped' : last;
  if (runEnded !== null && log.status !== ends) {
    fail('order', `run-log.json: the run ended (${runEnded}), so its status is ${show(ends)}${any ? ', a build having ended completed or file-only' : last !== undefined ? `, its last build's end` : ''}, not ${show(log.status)} (D-411)`);
  } else if (runEnded === null && !['running', 'stopped'].includes(log.status)) {
    fail('order', `run-log.json: status is ${show(log.status)}, but the run hasn't ended: ${queue.length > 0 ? `${queue.join(', ')} still queued` : 'a step or an answer is still to come'}; it is running (D-411)`);
  }
  // builds[]: one per finalized card, in finalize order, each with its status as the flow ends it (D-412).
  const logged = list(log.builds);
  for (const id of finalizeOrder) {
    const x = B.get(id);
    const entry = logged.find((y) => y.id === id);
    if (!entry) {
      if (!x.legacy) fail('run-log', `run-log.json builds[] has no build for ${id}, which the verification gate finalized (D-412)`);
      continue;
    }
    const inProgress = IN_PROGRESS.includes(x.status);
    if (inProgress ? !IN_PROGRESS.includes(entry.status) : entry.status !== x.status) {
      fail('run-log', `run-log.json builds[] ${id}'s status is ${show(entry.status)}, but the run log's steps and answers ${inProgress ? `leave it in progress (${x.status})` : `end it ${show(x.status)}`} (D-411, D-412)`);
    }
  }
  for (const entry of logged) if (!finalizeOrder.includes(entry.id)) fail('run-log', `run-log.json builds[] lists ${show(entry.id)}, which no verification gate answer finalized (D-411, D-412)`);
  const order = finalizeOrder.filter((id) => logged.some((y) => y.id === id));
  if (show(logged.map((y) => y.id)) !== show(order)) fail('run-log', `run-log.json builds[] is in the order ${logged.map((y) => y.id).join(', ')}; it is the finalize order, ${order.join(', ')} (D-412)`);
}

/**
 * A gate verdict's failing findings: those of a part that fails, information codes and accepted findings aside.
 * A part other than the budget that is `unverified` fails too (only the budget may stay unverified, D-164). The
 * budget's findings never fail (D-371): `over-target` is information and `unverified` is allowed.
 */
function failingFindings(rep, stage, covered) {
  if (!isObj(rep) || !isObj(rep.verdict)) return [];
  return list(rep.findings).filter((f) => partsOf(rep, stage).includes(f.part) && f.part !== 'budget' && ['fail', 'unverified'].includes(rep.verdict[f.part]) && !INFO_CODES.includes(f.code) && !covered(f));
}

/**
 * Where a gate verdict routes (gates.md): `forced` (FI-3), `hard` (a compile, V1 or V2 failure, or a part other
 * than the budget unverified), `soft` (only floor or the named damage source's part rolledSkill), or `pass`. A
 * failing part whose findings an escalation accepted passes. The budget routes nowhere (D-371): it is `pass` or
 * `unverified`, and its `over-target` findings are information, so a gate whose only issue is over target goes to
 * the design gate (a budget `fail` is refused as an unknown value, checkGateReport).
 */
function gateClass(rep, stage, covered) {
  if (rep.forced === 'infeasible') return 'forced';
  // D-436 (amendment 11): an R1b attempt whose card names a damage kind the named source shows nothing for fails, and
  // R1b retries within its counted retries, though the skeleton compiled.
  if (stage === 'R1b' && rep.verdict?.compiled === 'pass' && (rep.verdict.damage === 'fail' || list(rep.findings).some((f) => f.code === DAMAGE_MISSING))) return 'damage';
  const failing = GATE_PARTS[stage].filter((part) => {
    if (part === 'budget') return false;
    const v = rep.verdict[part];
    if (v === 'unverified') return true;
    if (v !== 'fail') return v !== 'pass';
    const findings = list(rep.findings).filter((f) => f.part === part && !INFO_CODES.includes(f.code));
    return part === 'compiled' || findings.length === 0 || findings.some((f) => !covered(f));
  });
  if (failing.some((part) => ['compiled', 'v1', 'v2'].includes(part))) return 'hard';
  return failing.length > 0 ? 'soft' : 'pass';
}
const describeClass = (cls) => ({ pass: 'passes', hard: 'fails its compile, V1 or V2 (or leaves one unverified)', soft: 'fails only its floor or named damage source (rolledSkill)', forced: 'is forced infeasible (FI-3)', damage: `names a damage kind the named source shows nothing for (${DAMAGE_MISSING}, D-436)` })[cls];
/** D-436: R1b's finding for a damage kind the card names that shows nothing on the named source; the attempt fails. */
const DAMAGE_MISSING = 'damage-missing';

/**
 * The plan claim a V4 finding's location names, `stages[<i>].claims[<k>] (<id>)` (stages/V4.md), with its source's
 * kind; null when the location names none, or its id isn't that claim's.
 */
function claimAt(plan, location) {
  const m = /^stages\[(\d+)\]\.claims\[(\d+)\](?: \((.+)\))?$/.exec(String(location ?? '').trim());
  const c = m ? list(list(plan?.stages)[Number(m[1])]?.claims)[Number(m[2])] : undefined;
  if (!isObj(c) || (m[3] !== undefined && c.id !== m[3])) return null;
  const kind = typeof c.source === 'string' ? (/^(ledger|price|data):/.exec(c.source)?.[1] ?? null) : c.source?.kind;
  return { id: c.id, kind };
}

/**
 * The first line where `got` and `want` differ, each line compared by `key` (trailing whitespace dropped by
 * default) and trailing blank lines ignored: `{n, got, want}`, `n` 1-based, or null when they are equal.
 */
function firstDifference(got, want, key = (l) => l.replace(/\s+$/, '')) {
  const trim = (ls) => {
    const out = ls.map(key);
    while (out.length > 0 && out[out.length - 1] === '') out.pop();
    return out;
  };
  const [a, b] = [trim(got), trim(want)];
  for (let k = 0; k < Math.max(a.length, b.length); k += 1) {
    if (a[k] !== b[k]) return { n: k + 1, got: a[k] ?? '<the end>', want: b[k] ?? '<the end>' };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------
// Reports (gates.md verdict files, source-markers.md V4 reports)
// ---------------------------------------------------------------------------------------------------

function checkGateReport(rep, g, fail, opts = { v4: false, legacy: true, held: false, plan: null }) {
  const bad = (why) => fail('gate-report', `${g.file}: ${why}`);
  if (!isObj(rep)) return bad('is a JSON object');
  if (rep.stage !== g.stage || rep.concept !== g.concept || rep.attempt !== g.attempt) {
    bad(`says ${show({ stage: rep.stage, concept: rep.concept, attempt: rep.attempt })}; its name says ${show({ stage: g.stage, concept: g.concept, attempt: g.attempt })}`);
  }
  if (!isObj(rep.verdict)) return bad('has no verdict object');
  // D-419: schema 4's D1 gate has the part `tree`; one written before a migrated run's first resume has none.
  const parts = g.stage === 'D1-gate' && opts.v4 && !opts.legacy ? D1_PARTS4 : GATE_PARTS[g.stage];
  // D-437: a verdict held to amendment 11's rules ranks its swaps by the named source's damage, an older one by Full DPS.
  if (g.stage === 'D1-gate' && opts.v4 && !opts.legacy) checkTreePart(rep, bad, (r, stage) => swapLabel(opts.held === true, r?.tree, opts.plan, stage));
  for (const part of parts) {
    // D-371: the D1 gate's budget is pass or unverified, never fail: a `fail` there is an unknown value.
    const allowed = g.stage === 'D1-gate' && part === 'budget' ? BUDGET_PARTS : PARTS;
    if (!allowed.includes(rep.verdict[part])) bad(`verdict.${part} is ${show(rep.verdict[part])}; one of ${allowed.join(', ')}${allowed === BUDGET_PARTS ? ' (the budget never fails, D-371)' : ''}`);
  }
  // D-436 (amendment 11): R1b's damage check, when its verdict has the part: each kind of damage the card names shows a
  // figure on the named source, else `damage-missing` fails the attempt.
  if (g.stage === 'R1b' && 'damage' in rep.verdict && !PARTS.includes(rep.verdict.damage)) bad(`verdict.damage is ${show(rep.verdict.damage)}; one of ${PARTS.join(', ')} (D-436)`);
  if (g.stage === 'R1b' && rep.verdict.damage === 'fail' && !list(rep.findings).some((f) => f.code === DAMAGE_MISSING)) bad(`says damage: "fail" with no ${DAMAGE_MISSING} finding; a damage kind the card names that shows nothing on the named source is a ${DAMAGE_MISSING} finding (D-436)`);
  if (!Array.isArray(rep.findings)) bad('has no findings list');
  // D-466 (amendment 13, Appendix A): F1's draftLeft, the draft it couldn't remove (changed on disk, or not this build's).
  if (g.stage === 'F1' && 'draftLeft' in rep && rep.draftLeft !== null && (typeof rep.draftLeft !== 'string' || rep.draftLeft.trim() === '')) bad(`draftLeft is ${show(rep.draftLeft)}; the draft F1 couldn't remove, its path in the builds folder, or null (D-466, Appendix A)`);
  // D-408: only the rival's R1b runs R1a-assemble's identity and sniff checks, and stops not-dealt when they fail.
  if (g.stage === 'R1b' && list(rep.findings).some((f) => f.code === 'not-dealt') && !RIVAL_CARD.test(g.concept)) {
    bad(`has the finding not-dealt, but ${g.concept} isn't the rival's card r<k>-x-<n>; only the rival's R1b runs the identity and sniff checks and stops not-dealt (D-408)`);
  }
  if (g.stage === 'D1-gate') {
    const b = rep.basis;
    if (!isObj(b) || !isObj(b.budget) || !Array.isArray(b.budget.slots) || !Array.isArray(b.budget.rates) || !isObj(b.budget.market) || !Array.isArray(b.budget.totals) || !Array.isArray(b.rolledSkill)) {
      bad('has no basis {budget: {rates, market, slots, totals}, rolledSkill: [...]}: the slot→price map, its rates, market and totals, and the figures the run checker recomputes the gate from (gates.md)');
    }
  }
}

/**
 * D-419: the D1 gate's `tree` part, checked for its shape and its agreement with its findings: the checker can't
 * recompute node power without the engine. `pass` has no `tree-swap` finding; `fail` has one or more, each naming a
 * rung; `unverified` has a `tool-error` (get_node_power failed or timed out) or `tool-refused` (D-421) finding and no
 * `tree-swap`, except when the compile didn't pass: then every other part is `unverified` with no finding of its own
 * (gates.md, "Every verdict file"; the WU-96 fix round), the tree included. The `design` field's rungs, when the gate wrote it, each carry `tree: {travel, points, bestSwap, needs}`:
 * travel and points whole numbers, travel at most points, `bestSwap` null or `{gainPercent, removed: [names], added:
 * [names]}`, `needs` the needs' reasons as text; a rung whose best swap gains 5% or more is exactly a rung with a
 * `tree-swap` finding. `label(rung, stage)` names what the gain is of: "damage" in a verdict held to amendment 11's rules
 * (D-437, node power's `MainDamage`; a pool move off the main group's weapon set keeps Full DPS), "Full DPS" before them.
 */
function checkTreePart(rep, bad, label = () => 'Full DPS') {
  const v = rep.verdict.tree;
  // A gate whose compile failed, or was refused, never reached node power: its tree is unverified as every part is.
  const compiled = rep.verdict.compiled === 'pass';
  const findings = list(rep.findings).filter((f) => f.part === 'tree');
  const swaps = findings.filter((f) => f.code === 'tree-swap');
  const tools = findings.filter((f) => TREE_CODES.unverified.includes(f.code));
  for (const f of findings) if (![...TREE_CODES.fail, ...TREE_CODES.unverified].includes(f.code)) bad(`has the tree finding ${show(f.code)}; the tree part's codes are tree-swap, tool-error and tool-refused (D-419, D-421)`);
  if (v === 'pass' && (swaps.length > 0 || tools.length > 0)) bad(`says tree: "pass" beside ${swaps.length > 0 ? 'a tree-swap finding' : `a ${tools[0].code} finding`}; a passing tree part leaves no swap and had its tool (D-419)`);
  if (v === 'fail' && (swaps.length === 0 || tools.length > 0)) bad(`says tree: "fail" ${swaps.length === 0 ? 'with no tree-swap finding' : `beside a ${tools[0].code} finding`}; a failing tree part names each rung's swap, a tree-swap finding (D-419)`);
  if (v === 'unverified' && ((tools.length === 0 && compiled) || swaps.length > 0)) bad(`says tree: "unverified" ${swaps.length > 0 ? 'beside a tree-swap finding' : 'with no tool-error or tool-refused finding'}; the tree is unverified only when get_node_power failed (tool-error), the call was refused (tool-refused), or the compile didn't pass (D-419, D-421)`);
  for (const f of swaps) if (typeof f.stage !== 'string') bad(`has a tree-swap finding with no stage; it names the rung the swap is on (D-419)`);
  const rungs = list(rep.design?.rungs);
  if (rungs.length === 0) return;
  const failing = new Set();
  for (const r of rungs) {
    const t = r.tree;
    const at = `design.rungs's ${show(r.stage)}`;
    if (!isObj(t)) {
      bad(`${at} has tree ${show(t)}; schema 4's design rung carries tree: {travel, points, bestSwap, needs} (D-419)`);
      continue;
    }
    if (!isInt(t.travel) || !isInt(t.points) || t.travel > t.points) bad(`${at} tree has travel ${show(t.travel)} of points ${show(t.points)}; both whole numbers, travel at most points (D-419)`);
    const s = t.bestSwap;
    const strings = (x) => Array.isArray(x) && x.length > 0 && x.every((n) => typeof n === 'string' && n.trim() !== '');
    if (s !== null && !(isObj(s) && isNum(s.gainPercent) && strings(s.removed) && strings(s.added))) bad(`${at} tree's bestSwap is ${show(s)}; null, or {gainPercent, removed: [names], added: [names]} (D-419)`);
    // C-55a, §14: a pool move names its weapon set, 1 or 2; D-439: the branches the swap freed, a list.
    if (isObj(s) && 'weaponSet' in s && s.weaponSet !== 1 && s.weaponSet !== 2) bad(`${at} tree's bestSwap.weaponSet is ${show(s.weaponSet)}; a pool move is within weapon set 1 or 2 (C-55a, §14)`);
    if (isObj(s) && 'branches' in s && !(Array.isArray(s.branches) && s.branches.length > 0)) bad(`${at} tree's bestSwap.branches is ${show(s.branches)}; the branches the swap freed, a non-empty list (D-439)`);
    if (!Array.isArray(t.needs) || !t.needs.every((n) => typeof n === 'string' && n.trim() !== '')) bad(`${at} tree's needs are ${show(t.needs)}; the needs' reasons, as text (D-418, D-419)`);
    if (isObj(s) && isNum(s.gainPercent) && s.gainPercent >= TREE_FAIL_PERCENT) failing.add(r.stage);
  }
  if (v === 'unverified') return;
  const rungOf = (stage) => rungs.find((r) => r.stage === stage);
  const rule = (l) => (l === 'damage' ? 'D-419, D-437' : 'D-419');
  for (const stage of failing) {
    const l = label(rungOf(stage), stage);
    if (!swaps.some((f) => f.stage === stage)) bad(`rung ${stage}'s best swap left gains ${pct1(rungOf(stage).tree.bestSwap.gainPercent)}% ${l}, at least ${TREE_FAIL_PERCENT}%, but no tree-swap finding names it: the tree part fails that rung (${rule(l)})`);
  }
  for (const f of swaps) {
    if (typeof f.stage !== 'string' || failing.has(f.stage)) continue;
    const l = label(rungOf(f.stage), f.stage);
    bad(`has a tree-swap finding on rung ${f.stage}, whose best swap left gains under ${TREE_FAIL_PERCENT}% ${l} (design.rungs's tree): a rung fails only at ${TREE_FAIL_PERCENT}% or more (${rule(l)})`);
  }
}

/** The R1b finding codes that end a card's verification with no compile and no retry (D-334, D-342, D-400, D-408). */
const TERMINAL_R1B = ['wrong-ascendancy', 'not-a-skill', 'not-in-pin', 'not-dealt'];

/**
 * An R1b verdict that compiled nothing (`compiles: 0`) and failed with a terminal code, which it returns (else
 * null). `not-a-skill` (D-334): the card's damage source isn't a skill, so no retry can compile it, and the card
 * can't be finalized yet (D-303). `wrong-ascendancy` (D-342): the card's ascendancy doesn't own the passive-tree
 * node that grants its skill, so no retry can change its identity; the card is failed, and can't be finalized.
 * `not-in-pin` (D-400): the card rests on an entry the PoB pin doesn't know, so nothing compiles it, and it can't be
 * finalized yet. `not-dealt` (D-408): the rival's card failed R1a-assemble's identity and sniff checks.
 */
function terminalR1b(rep) {
  if (!isObj(rep) || !isObj(rep.verdict) || rep.verdict.compiled !== 'fail' || rep.compiles !== 0) return null;
  return TERMINAL_R1B.find((code) => list(rep.findings).some((f) => f.code === code)) ?? null;
}

/**
 * D-287, D-339, D-391, D-392: the deck `cards.md`, against the brainstorm rounds the log ran. Its H2s are the header
 * (`What the cards share`, at most 80 words, and `How they differ`, one line), one `Round <k>` per round
 * R1a-assemble dealt, then `Not dealt` and `Found, not used` (at most five findings, or "None."). Each card line is
 * `- <card id> "<Name>" | …`. A round deals 6–9 cards, and the deck (every round's dealt cards so far) keeps at
 * least two under-played cards, each line labelled `under-played (judgment: …)`; a round short of either is
 * accepted only with its reason, the `shortReason` on its R1a-assemble entry. A card made at a gate (`r<k>-g-<n>`)
 * sits under its round, marked `made at the gate`, and counts toward no deal; `checkGateCards` holds it to the log.
 * Every researcher's card of a dealt round is in the deck, dealt or not, and every card `cards/<id>.md` is of a
 * round the log ran. The rival's card (`r<k>-x-<n>`, D-408) is no deck card.
 *
 * Amendment 8: a line's `engine: <family> from <family>` names its engine in data/rules/vocabulary.md's words (D-401,
 * D-405); once the deck names one, or the run ran the rival (`ctx.rivalRan`), every dealt researcher's card names
 * one. A round deals at most half its cards on one engine, rounded down (an engine whose consumed family is `none`
 * is no engine), unless its R1a-assemble entry's `shortReason` says `short: <n> cards share one engine` (the rule
 * yields to the minimum only: such a round deals the fewest extra cards that reach 6, so no more than 6) or the user's
 * note for the round (`ctx.noteOf(k)`, the `more` answer that opened it) names the engine's consumed family. The
 * header's "How they differ" names each engine of the deck's dealt cards with its count, `<engine> (<n>)`. A line
 * `waits on the pin: <entry>` is also marked `can't be finalized yet: <why>` (D-303, D-400).
 */
function checkDeck(text, stages, cardIds, fail, ctx = { rivalRan: false, noteOf: () => undefined }) {
  const rounds = [];
  let prev = null;
  stages.forEach((s, i) => {
    if (!isObj(s) || s.outcome === 'missing') return;
    if (s.stage === 'R1a' && prev !== 'R1a') rounds.push({ k: rounds.length + 1, assembly: null });
    if (ASSEMBLY_STAGES.includes(s.stage) && rounds.length > 0) rounds[rounds.length - 1].assembly = { ...s, i };
    prev = s.stage;
  });
  const dealtRounds = rounds.filter((r) => r.assembly !== null);
  // D-429: a run whose brainstorm rounds R1a-synthesize composed writes a composite deck.
  const composite = stages.some((s) => isObj(s) && s.stage === 'R1a-synthesize');
  // C-52, D-319: R1a writes a card in its own round, so no card's round is past the brainstorm rounds the log ran
  // (counted with the researchers that returned without their file, which may have written cards); a card made at
  // a gate is of the latest round (D-391).
  const ran = stages.filter((s, i) => isObj(s) && s.stage === 'R1a' && stages[i - 1]?.stage !== 'R1a').length;
  for (const id of cardIds) {
    const k = Number(/^r(\d+)-/.exec(id)[1]);
    if (k > ran) fail('layout', `cards/${id}.md is a card of brainstorm round ${k}, but run-log.json runs ${ran} brainstorm round(s); R1a writes a card only in its own round (§2, D-319)`);
  }
  if (text === null) {
    if (dealtRounds.length > 0) fail('layout', composite ? `cards.md is missing, but R1a-synthesize composed ${dealtRounds.length} brainstorm round(s); it writes the deck there (§2, D-429)` : `cards.md is missing, but R1a-assemble dealt ${dealtRounds.length} brainstorm round(s); it writes the deck there (§2, D-287)`);
    return;
  }
  if (composite) {
    checkCompositeDeck(parseDeck(text), dealtRounds, stages, cardIds, fail, ctx);
    return;
  }
  const deck = parseDeck(text);
  const want = [...DECK_HEADER, ...dealtRounds.map((r) => `Round ${r.k}`), ...DECK_FOOTER];
  if (show(deck.h2) !== show(want)) fail('deck', `cards.md's H2s are ${show(deck.h2)}; R1a-assemble writes the header ("What the cards share", "How they differ"), one "Round <k>" per brainstorm round it dealt, then "Not dealt" and "Found, not used": ${show(want)} (D-287, D-392)`);
  // D-392: the header says once what the cards share, in at most 80 words, and the deck's shape in one line.
  const body = (title) => deck.body?.get(title) ?? [];
  if (deck.h2.includes('What the cards share')) {
    const words = countWords(body('What the cards share').map((l) => l.raw));
    if (words === 0 || words > 80) fail('deck', `cards.md's "What the cards share" holds ${words} words; it says the cards' common core once, in player terms, in 1 to 80 words (D-392)`);
  }
  // D-424: one paragraph, however many lines it wraps over: a paragraph is a run of lines with no blank line between.
  const paragraphs = body('How they differ').filter((l, k, all) => k === 0 || l.n !== all[k - 1].n + 1).length;
  if (deck.h2.includes('How they differ') && paragraphs !== 1) fail('deck', `cards.md's "How they differ" holds ${paragraphs} paragraphs; it is one paragraph on the deck's shape (D-392, D-424)`);
  const found = body('Found, not used');
  if (deck.h2.includes('Found, not used') && !(found.length === 1 && found[0].raw === 'None.') && (found.length === 0 || found.length > 5 || found.some((l) => !/^[-*]\s+\S/.test(l.raw)))) {
    fail('deck', `cards.md's "Found, not used" holds ${found.length} line(s); it lists up to five strong research findings no card uses, each "- <finding>: <why no card uses it>", or says "None." (D-392)`);
  }
  // D-401, D-405: each engine part's form and words; D-400: a card waiting on the pin can't be finalized yet.
  const vocab = vocabularyWords();
  // §11: an amendment-8-or-later run is dated by its rival, or by its skill revision (D-443): every round its log deals
  // from the stamp on (`ctx.heldStage`, 0 for a run init wrote with it) names its engines.
  const heldStage = typeof ctx.heldStage === 'number' ? ctx.heldStage : Infinity;
  const engineRequired = ctx.rivalRan || deck.entries.some((d) => d.engines.length > 0);
  for (const d of deck.entries) {
    if (d.name === null || d.name.trim() === '') fail('deck', `cards.md:${d.n}: ${show(d.id)}'s line gives no name; a card line is - <card id> "<Name>" | … (D-392)`);
    if (d.engines.length > 1) fail('deck', `cards.md:${d.n}: ${d.id}'s line names ${d.engines.length} engines; a deck line names one, engine: <family> from <family> (D-405)`);
    for (const e of d.engines) {
      if (!e.ok) fail('deck', `cards.md:${d.n}: ${d.id}'s ${show(e.raw)} isn't "engine: <family> from <family>", the consumed family, then its supply's, each one word of data/rules/vocabulary.md (D-401, D-405)`);
      else if (vocab === null) fail('deck', `cards.md:${d.n}: ${d.id}'s engine can't be checked: data/rules/vocabulary.md, the mechanic families, can't be read (D-401)`);
      else for (const w of [e.consumed, e.supply]) if (!vocab.has(w)) fail('deck', `cards.md:${d.n}: ${d.id}'s engine names ${show(w)}, which isn't a family of data/rules/vocabulary.md (or none); an engine uses only its words (D-401, D-405)`);
    }
    if (d.waits !== null) {
      if (!/^waits on the pin:\s*\S/i.test(d.waits)) fail('deck', `cards.md:${d.n}: ${d.id}'s ${show(d.waits)} isn't "waits on the pin: <entry>", the entry the PoB pin doesn't know (D-400)`);
      if (!d.parts.some((p) => CANT_FINALIZE.test(p))) fail('deck', `cards.md:${d.n}: ${d.id} waits on the pin, but its line isn't marked "can't be finalized yet: <why>"; a card resting on an entry the PoB pin doesn't know is dealt as can't be finalized yet (D-303, D-400)`);
    }
    // D-408: the rival's card is no researcher's card of a round; R1b-assemble gives it a dossier row instead.
    if (RIVAL_CARD.test(d.id)) fail('deck', `cards.md:${d.n}: lists ${d.id}, the rival's card, which the deck doesn't hold; R1b-assemble gives it a dossier row (D-408)`);
  }
  const listed = new Map();
  let underPlayed = 0;
  /** The deck's engines (the dealt researchers' cards of every round) with their counts, for the header (D-405). */
  const deckEngines = new Map();
  for (const r of dealtRounds) {
    const dealt = [];
    for (const d of deck.entries.filter((x) => x.round === r.k)) {
      const gate = GATE_CARD.exec(d.id);
      if (RIVAL_CARD.test(d.id)) continue;
      if (gate) {
        // D-391: a card made at a gate sits under its round, marked; checkGateCards holds it to the checkpoint that made it.
        if (Number(gate[1]) !== r.k) fail('deck', `cards.md:${d.n}: round ${r.k} lists ${d.id}, a card made at a gate in round ${gate[1]}; R1b-assemble adds it under "Round ${gate[1]}" (D-391)`);
        if (d.made === null) fail('deck', `cards.md:${d.n}: ${d.id} is a card made at a gate, but its line isn't marked "${MADE_MARK}" (D-391)`);
      } else {
        if (!new RegExp(`^r${r.k}-[a-c]-[1-9]\\d*$`).test(d.id)) fail('deck', `cards.md:${d.n}: round ${r.k} deals ${show(d.id)}, which isn't a card of round ${r.k}, r${r.k}-<letter>-<n> (D-319)`);
        else if (!cardIds.has(d.id)) fail('deck', `cards.md:${d.n}: round ${r.k} deals ${d.id}, but cards/${d.id}.md doesn't exist (C-52)`);
        if (d.made !== null) fail('deck', `cards.md:${d.n}: ${d.id} is marked "${MADE_MARK}", but it is a researcher's card; only a card r<k>-g-<n> is made at a gate (D-391)`);
        dealt.push(d);
      }
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
    // D-405: no more than half the round's dealt cards on one engine, rounded down.
    const engines = new Map();
    const dated = r.assembly.i >= heldStage;
    for (const d of dealt) {
      if ((engineRequired || dated) && d.engines.length === 0) fail('deck', `cards.md:${d.n}: round ${r.k} deals ${d.id} with no "engine: <family> from <family>"; ${ctx.rivalRan ? 'a run that ran the rival (amendment 8, D-408)' : dated ? `a run held to amendment 11 (skillRevision ${A11}), dated amendment-8-or-later by its skill revision (§11)` : 'a deck that names an engine'} names one on every dealt card's line (D-405)`);
      const e = d.engines[0];
      if (!e?.ok || e.consumed === 'none') continue;
      engines.set(e.key, { consumed: e.consumed, n: (engines.get(e.key)?.n ?? 0) + 1 });
      deckEngines.set(e.key, (deckEngines.get(e.key) ?? 0) + 1);
    }
    const cap = Math.floor(dealt.length / 2);
    for (const [key, { consumed, n }] of engines) {
      if (n <= cap) continue;
      const shortFor = typeof reason === 'string' && new RegExp(`\\bshort: ${n} cards share one engine\\b`).test(reason);
      const note = ctx.noteOf(r.k);
      const asked = typeof note === 'string' && new RegExp(`(?<![a-z0-9])${consumed.replace(/-/g, '[- ]')}(?![a-z0-9])`, 'i').test(note);
      if (!shortFor && !asked) {
        fail('deck', `cards.md's round ${r.k} deals ${n} of ${dealt.length} cards on the engine "${key}"; a round deals at most half its cards on one engine, rounded down (${cap} of ${dealt.length}), unless it is short for that reason (its R1a-assemble entry's shortReason "short: ${n} cards share one engine") or the user's note for the round asks for that engine (D-405)`);
      } else if (!asked && dealt.length > DEAL.min) {
        // D-405 yields to the minimum only: the round deals the fewest extra cards that reach 6, and no more.
        fail('deck', `cards.md's round ${r.k} is short for one engine (its shortReason "short: ${n} cards share one engine"), but it deals ${dealt.length} cards; a round the rule would leave under ${DEAL.min} deals only the fewest extra cards that reach ${DEAL.min}, the rest under "Not dealt" (D-405)`);
      }
    }
  }
  // D-405: the header names each engine and its card count.
  for (const [key, n] of deckEngines) {
    if (!(deck.differ ?? '').includes(`${key} (${n})`)) fail('deck', `cards.md's "How they differ" doesn't name the engine "${key}" with its count, "${key} (${n})"; the header names each engine of the deck's dealt cards and its count (D-405)`);
  }
  for (const d of deck.entries.filter((x) => x.round !== null && !dealtRounds.some((r) => r.k === x.round))) {
    fail('deck', `cards.md:${d.n}: lists ${d.id} under "Round ${d.round}", which R1a-assemble didn't deal (D-287)`);
  }
  for (const d of deck.entries.filter((x) => x.section === 'Not dealt')) {
    if (GATE_CARD.test(d.id)) fail('deck', `cards.md:${d.n}: "Not dealt" names ${d.id}, a card made at a gate, which R1b-assemble adds under its round (D-391)`);
    else if (!cardIds.has(d.id)) fail('deck', `cards.md:${d.n}: "Not dealt" names ${show(d.id)}, which is no card of the run (cards/<id>.md, C-52)`);
    else if (listed.has(d.id)) fail('deck', `cards.md:${d.n}: ${d.id} is under "Not dealt", but line ${listed.get(d.id)} lists it already`);
    listed.set(d.id, d.n);
  }
  const dealtK = new Set(dealtRounds.map((r) => r.k));
  for (const id of cardIds) {
    const k = Number(/^r(\d+)-/.exec(id)[1]);
    if (dealtK.has(k) && !GATE_CARD.test(id) && !RIVAL_CARD.test(id) && !listed.has(id)) fail('deck', `cards/${id}.md is a card of round ${k}, which R1a-assemble dealt, but cards.md neither deals it nor lists it under "Not dealt" (§7.5)`);
  }
}

/**
 * D-465 (amendment 13, §22): each card with a Pieces table that was dealt at or after revision 13's boundary (a
 * researcher's card or a composite by its round's R1a-assemble or R1a-synthesize entry, a card made at a gate by the
 * checkpoint that made it) takes no rune over the budget in an `in` or `scheduled` row, unless the user asked for it (the
 * brief's `around`, `like` or `notes`, or a gate answer's words name it). An `out` row and research mentions are allowed.
 */
function checkOverBudgetCards(log, cardIds, cardOf, fail) {
  const stages = Array.isArray(log.stages) ? log.stages : [];
  const fromStage = heldFrom(log, 'stages', A13);
  const fromCheckpoint = heldFrom(log, 'checkpoints', A13);
  if (fromStage === Infinity) return;
  const dealtAt = new Map();
  let k = 0;
  stages.forEach((s, i) => {
    if (!isObj(s)) return;
    if (s.stage === 'R1a' && stages[i - 1]?.stage !== 'R1a') k += 1;
    if (ASSEMBLY_STAGES.includes(s.stage) && !idle(s) && k > 0) dealtAt.set(k, i);
  });
  const checkpoints = Array.isArray(log.checkpoints) ? log.checkpoints : [];
  const held = (id) => {
    if (GATE_CARD.test(id)) {
      const at = checkpoints.findIndex((c) => isObj(c) && list(c.newCards).some((n) => n.id === id));
      return at >= 0 && at >= fromCheckpoint;
    }
    const at = dealtAt.get(Number(/^r(\d+)-/.exec(id)?.[1]));
    return at !== undefined && at >= fromStage;
  };
  const says = userWords(log);
  for (const id of [...cardIds].sort()) {
    if (!held(id)) continue;
    for (const r of cardOf(id).pieces?.rows ?? []) {
      const kind = overBudgetRune(r.piece);
      if (kind === null || !['in', 'scheduled'].includes(r.status) || askedFor(r.piece, says)) continue;
      fail('runes', `cards/${id}.md:${r.line}: the Pieces row ${show(r.key)} takes ${show(r.piece)} (${r.status}), ${kind === 'legacy' ? 'a "Legacy of …" soul core' : 'the Raven-Touched Shard'}, a rune over the budget, but neither the brief's around, like or notes nor a gate answer names it; research and design leave every rune over the budget out unless the user asks for it (D-465)`);
    }
  }
}

/** D-339, D-429: whether a composite takes a piece marked under-played: a Pieces row in or scheduled, its Kind `, under-played`. */
const takesUnderPlayed = (card) => !!card?.pieces?.rows.some((r) => r.underPlayed && ['in', 'scheduled'].includes(r.status));
/**
 * D-429: whether a card counts as verified: its `### Structure check` holds more than `Not checked yet.` (what
 * R1a-synthesize writes under each H3 of a composite's verification half), or R1b passed on it.
 */
const verifiedCard = (card, stages, id) => card?.structure?.checked === true || stages.some((s) => isObj(s) && s.stage === 'R1b' && s.concept === id && s.outcome === 'pass');

/**
 * D-429 (Appendix A, R1a-synthesize.md): a deck line's structure, its first part after the name: the identity
 * `<className>, <ascendancy>, <named damage source>`, or under one fixed identity the engine key `<consumed> from
 * <supply>` in data/rules/vocabulary.md's words, or `none`. The problem with it, or null.
 */
function structureProblem(part, vocab) {
  const p = String(part ?? '').trim();
  const engine = /^([a-z0-9]+(?:-[a-z0-9]+)*) from ([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(p);
  if (engine) {
    if (vocab === null) return "its engine can't be checked: data/rules/vocabulary.md, the mechanic families, can't be read (D-401)";
    const off = [engine[1], engine[2]].filter((w) => !vocab.has(w));
    return off.length > 0 ? `its engine names ${off.map((w) => show(w)).join(' and ')}, which isn't a family of data/rules/vocabulary.md (or none); an engine key uses only its words (D-401, D-405, D-429)` : null;
  }
  if (p === 'none' || /^[^,|]+, [^,|]+, \S.*$/.test(p)) return null;
  return `its structure is ${show(p)}; it is "<className>, <ascendancy>, <named damage source>", or under one fixed identity the engine key "<consumed> from <supply>" or "none" (D-429)`;
}

/**
 * D-429, D-432 (Appendix A, R1a-synthesize.md): a composite deck `cards.md`, against the brainstorm rounds R1a-synthesize
 * composed. Its H2s: "What the composites share" (1–80 words), "How they differ" (one paragraph), "The obvious build"
 * (one line `- r1-a-1 "<name>" | <its kit>`, the obvious card's, D-403, or "None."), one "Round <k>" per composed round
 * ("None." when it composed none), "Cards", "Pieces not used" (at most 10 lines `- <key> <piece>: <why>`, or "None."),
 * "Not composed" (`- <structure>: <why>` lines, or "None."), then "Superseded" only when a later round recomposed. A
 * round lists its composites `r<k>-s-<n>`, each with its card and its structure (`structureProblem`), and the cards made
 * at its gate; it composes 1 to 4, and is short, accepted only with its R1a-synthesize entry's shortReason, with fewer
 * than 2 or with none taking a piece marked under-played (D-339). "Cards" lists every card but the composites, each line
 * with its structure and `fed: <composite ids | none>` naming composites the deck holds: every researcher's card of a
 * composed round, and each gate-made card and rival's card a synthesis ran after (D-391, D-408). Every composite keeps
 * its round line; a superseded one is also listed under "Superseded", never one verified (D-429), its successor a
 * later round's. The engine rule (D-405) doesn't apply to composites, which differ by structure or by a split's side.
 */
function checkCompositeDeck(deck, rounds, stages, cardIds, fail, ctx) {
  const bad = (why) => fail('deck', `cards.md${why}`);
  const want = [...COMPOSITE_HEADER, ...rounds.map((r) => `Round ${r.k}`), ...COMPOSITE_FOOTER];
  const got = deck.h2.includes(SUPERSEDED) ? [...want, SUPERSEDED] : want;
  if (show(deck.h2) !== show(got)) bad(`'s H2s are ${show(deck.h2)}; R1a-synthesize writes ${show(want)}, then "${SUPERSEDED}" only when a later round recomposed (D-429, D-432)`);
  const body = (title) => deck.body?.get(title) ?? [];
  const none = (lines) => lines.length === 1 && lines[0].raw === 'None.';
  const cardOf = (id) => ctx.cardOf?.(id) ?? null;
  // D-392, D-424: what the composites share, once, in 1 to 80 words; how they differ, one paragraph.
  if (deck.h2.includes(COMPOSITE_HEADER[0])) {
    const words = countWords(body(COMPOSITE_HEADER[0]).map((l) => l.raw));
    if (words === 0 || words > 80) bad(`'s "${COMPOSITE_HEADER[0]}" holds ${words} words; it says the composites' common core once, in player terms, in 1 to 80 words (D-392, D-432)`);
  }
  const paragraphs = body('How they differ').filter((l, k, all) => k === 0 || l.n !== all[k - 1].n + 1).length;
  if (deck.h2.includes('How they differ') && paragraphs !== 1) bad(`'s "How they differ" holds ${paragraphs} paragraphs; it is one paragraph, each composite's structure and what sets it apart (D-392, D-424, D-432)`);
  // D-403, D-429: the obvious build, the baseline judged as written: one line naming the obvious card r1-a-1, or None.
  // (when the run has no obvious card, or it failed its identity check).
  if (deck.h2.includes(COMPOSITE_HEADER[2])) {
    const lines = body(COMPOSITE_HEADER[2]);
    const o = deck.obvious;
    if (!none(lines)) {
      if (lines.length !== 1 || o === null) bad(`'s "${COMPOSITE_HEADER[2]}" holds ${lines.length} line(s); it is one line, - <id> "<name>" | <its kit>, or "None." (D-403, D-429)`);
      else if (o.id !== 'r1-a-1' || !cardIds.has('r1-a-1') || cardOf('r1-a-1')?.fields?.get('Obvious build') === undefined) bad(`:${o.n}: the obvious build names ${show(o.id)}; it is the obvious card r1-a-1, researcher a's first card in round 1, which carries "- Obvious build:" (D-403)`);
    }
  }
  const unused = body('Pieces not used');
  if (deck.h2.includes('Pieces not used') && !none(unused)) {
    if (unused.length === 0 || unused.length > 10) bad(`'s "Pieces not used" holds ${unused.length} line(s); it lists at most 10, the strongest first, or says "None." (D-432)`);
    for (const l of unused) if (!new RegExp(`^[-*]\\s+${PIECE_KEY}\\s+\\S.*:\\s*\\S`).test(l.raw)) bad(`:${l.n}: ${show(l.raw)} isn't "- <key> <piece>: <why no composite takes it>", the key a Pieces row's or an Ideas line's (D-432, Appendix A)`);
  }
  const notComposed = body('Not composed');
  if (deck.h2.includes('Not composed') && !none(notComposed)) {
    if (notComposed.length === 0) bad(`'s "Not composed" is empty; it lists each structure left out, "- <structure>: <why>", or says "None." (D-429)`);
    for (const l of notComposed) if (!/^[-*]\s+\S[^:]*:\s*\S/.test(l.raw)) bad(`:${l.n}: ${show(l.raw)} isn't "- <structure>: <why>" (D-429, Appendix A)`);
  }
  // Each line's name, its engine's words (D-401, D-405), a card waiting on the pin (D-400); the rival's card unrounded.
  const vocab = vocabularyWords();
  for (const d of deck.entries) {
    if (d.name === null || d.name.trim() === '') bad(`:${d.n}: ${show(d.id)}'s line gives no name; a deck line is - <id> "<Name>" | … (D-392)`);
    for (const e of d.engines) {
      if (!e.ok) bad(`:${d.n}: ${d.id}'s ${show(e.raw)} isn't "engine: <family> from <family>", each one word of data/rules/vocabulary.md (D-401, D-405)`);
      else if (vocab !== null) for (const w of [e.consumed, e.supply]) if (!vocab.has(w)) bad(`:${d.n}: ${d.id}'s engine names ${show(w)}, which isn't a family of data/rules/vocabulary.md (or none) (D-401, D-405)`);
    }
    // D-429: a composite's round line and every "Cards" line give the structure first.
    if (COMPOSITE_CARD.test(d.id) || d.section === 'Cards') {
      const why = structureProblem(d.parts[0], vocab);
      if (why !== null) bad(`:${d.n}: ${d.id}'s line: ${why}`);
    }
    if (d.waits !== null && !d.parts.some((p) => CANT_FINALIZE.test(p))) bad(`:${d.n}: ${d.id} waits on the pin, but its line isn't marked "can't be finalized yet: <why>" (D-303, D-400)`);
    if (RIVAL_CARD.test(d.id) && d.section !== 'Cards') bad(`:${d.n}: lists ${d.id}, the rival's card, under ${show(d.section)}; the rival's card is no composite: R1b-assemble gives it a dossier row, and "Cards" lists it (D-408, D-429)`);
  }
  // The rounds: each one's composites, 1 to 4, and the short round's reason (D-339, D-429); the cards made at its gate.
  const listed = new Map();
  for (const r of rounds) {
    const composites = [];
    const lines = body(`Round ${r.k}`);
    if (lines.some((l) => !/^[-*]\s/.test(l.raw)) && !none(lines)) bad(`'s round ${r.k} holds ${show(lines.find((l) => !/^[-*]\s/.test(l.raw)).raw)}; a round lists its composites, one line each, or says "None." when it composed none (D-429)`);
    for (const d of deck.entries.filter((x) => x.round === r.k)) {
      const gate = GATE_CARD.exec(d.id);
      const comp = COMPOSITE_CARD.exec(d.id);
      if (gate) {
        if (Number(gate[1]) !== r.k) bad(`:${d.n}: round ${r.k} lists ${d.id}, a card made at a gate in round ${gate[1]}; R1b-assemble adds it under "Round ${gate[1]}" (D-391)`);
        if (d.made === null) bad(`:${d.n}: ${d.id} is a card made at a gate, but its line isn't marked "${MADE_MARK}" (D-391)`);
      } else if (comp && Number(comp[1]) === r.k) {
        composites.push(d);
        if (!cardIds.has(d.id)) bad(`:${d.n}: round ${r.k} composes ${d.id}, but cards/${d.id}.md doesn't exist (C-52, D-429)`);
      } else if (!RIVAL_CARD.test(d.id)) bad(`:${d.n}: round ${r.k} lists ${show(d.id)}; a composite deck's round lists its composites r${r.k}-s-<n> and the cards made at its gate, and the other cards go under "Cards" (D-429)`);
      if (listed.has(d.id)) bad(`:${d.n}: ${d.id} is listed again (line ${listed.get(d.id)}); a round line is kept once (D-429)`);
      listed.set(d.id, d.n);
    }
    const takes = composites.filter((d) => takesUnderPlayed(cardOf(d.id))).length;
    if (composites.length > COMPOSE.max) bad(`'s round ${r.k} composes ${composites.length} composites; a round composes 1 to ${COMPOSE.max} (D-429, NFR-23)`);
    const reason = r.assembly.shortReason;
    if ((composites.length < COMPOSE.min || takes === 0) && !(typeof reason === 'string' && reason.trim() !== '')) {
      bad(`'s round ${r.k} composes ${composites.length} composite(s), ${takes} of them taking a piece marked under-played; a round is short with fewer than ${COMPOSE.min}, or with none taking one (D-339, D-429), but its ${r.assembly.stage} entry, run-log.json stages[${r.assembly.i}], has no shortReason; a short round is accepted only with its reason`);
    }
  }
  for (const d of deck.entries.filter((x) => x.round !== null && !rounds.some((r) => r.k === x.round))) bad(`:${d.n}: lists ${d.id} under "Round ${d.round}", which R1a-synthesize didn't compose (D-429)`);
  // Superseded (D-429): a composite a later round recomposed keeps its round line; never one verified or built, and its
  // successor a later round's.
  const roundOf = (id) => Number(/^r(\d+)-/.exec(String(id))?.[1] ?? 0);
  const ran = (id) => stages.some((s) => isObj(s) && s.stage === 'R1b' && s.concept === id && s.outcome !== 'missing');
  const seen = new Set();
  for (const s of deck.superseded) {
    if (!s.ok) {
      bad(`:${s.n}: ${show(s.raw)} isn't "- <old id> "<name>" → <new id>" (D-429, Appendix A)`);
      continue;
    }
    if (!COMPOSITE_CARD.test(s.old) || !cardIds.has(s.old)) bad(`:${s.n}: supersedes ${show(s.old)}, which is no composite's card of the run (cards/r<k>-s-<n>.md, D-429)`);
    else if (!listed.has(s.old)) bad(`:${s.n}: supersedes ${s.old}, but no round lists it; a superseded composite keeps its round line, still pickable (D-429)`);
    if (seen.has(s.old)) bad(`:${s.n}: ${s.old} is superseded twice`);
    seen.add(s.old);
    if (ran(s.old) || verifiedCard(cardOf(s.old), stages, s.old)) bad(`:${s.n}: supersedes ${s.old}, which R1b verified; a verified or built composite is never superseded, and a recomposition of its structure is a separate composite (D-429)`);
    const next = deck.entries.find((d) => d.id === s.next && d.round !== null);
    if (!COMPOSITE_CARD.test(s.next) || next === undefined || next.round <= roundOf(s.old)) bad(`:${s.n}: ${s.old}'s successor ${show(s.next)} isn't a composite a later round lists; a later synthesis gives a recomposed structure a new id and name (D-392, D-429)`);
  }
  // Cards (D-429): every card but the composites, each with the composites it fed.
  const composites = new Set([...listed.keys()].filter((id) => COMPOSITE_CARD.test(id)));
  const cardLines = new Map();
  for (const d of deck.entries.filter((x) => x.section === 'Cards')) {
    if (COMPOSITE_CARD.test(d.id)) bad(`:${d.n}: "Cards" lists ${d.id}, a composite; it lists every other card, each with the composites it fed (D-429)`);
    else if (!cardIds.has(d.id)) bad(`:${d.n}: "Cards" names ${show(d.id)}, which is no card of the run (cards/<id>.md, C-52)`);
    if (cardLines.has(d.id)) bad(`:${d.n}: "Cards" lists ${d.id} again (line ${cardLines.get(d.id)})`);
    cardLines.set(d.id, d.n);
    if (d.fed === null) bad(`:${d.n}: ${d.id}'s line has no "fed: <composite ids | none>"; each card says which composites it fed (D-429, Appendix A)`);
    else for (const id of d.fed) if (!composites.has(id)) bad(`:${d.n}: ${d.id} fed ${show(id)}, which is no composite the deck holds (D-429)`);
  }
  // The cards a synthesis must have listed: a composed round's researchers' cards, and the gate-made and rival's cards
  // that existed when the last synthesis ran (the gate-made card's first R1b, the rival's RV step, before it).
  const composed = new Set(rounds.map((r) => r.k));
  const lastSynthesis = stages.reduce((at, s, i) => (isObj(s) && s.stage === 'R1a-synthesize' && s.outcome !== 'missing' ? i : at), -1);
  const before = new Set();
  for (const [s, id] of rivalCards(stages)) if (stages.indexOf(s) < lastSynthesis) before.add(id);
  stages.forEach((s, i) => { if (isObj(s) && s.stage === 'R1b' && GATE_CARD.test(String(s.concept)) && i < lastSynthesis) before.add(s.concept); });
  for (const id of [...cardIds].sort()) {
    const k = roundOf(id);
    if (RESEARCHER_CARD.test(id) && composed.has(k) && !cardLines.has(id)) bad(`'s "Cards" doesn't list ${id}, a researcher's card of round ${k}; the deck lists every card but the composites, the seed marked, with the composites each fed (D-429)`);
    else if (before.has(id) && !cardLines.has(id)) bad(`'s "Cards" doesn't list ${id}, ${RIVAL_CARD.test(id) ? "the rival's card" : 'a card made at a gate'}, which existed when the last R1a-synthesize ran; the deck lists every card but the composites (D-429)`);
    if (COMPOSITE_CARD.test(id) && composed.has(k) && !listed.has(id)) bad(`'s round ${k} doesn't list ${id}, a composite of round ${k} (cards/${id}.md); a round keeps every composite's line (D-429)`);
  }
}

/** A Drops item (D-433, Appendix A): `<group> (<clear | per corpse | boss>) −<x>%`, or that figure's estimate. */
const DROP_ITEM = /^\S.*\((?:clear|per corpse|boss)\)\s+(?:[−+-]?\d+(?:\.\d+)?%|estimate \(.+\))$/;
/** A Drops cell: `not measured (<why>)`, `estimate (<reason>)`, or its drop items separated by "; ". */
const dropsOk = (d) => /^not measured \(.+\)$/.test(d) || /^estimate \(.+\)$/.test(d) || d.split(/;\s+/).every((x) => DROP_ITEM.test(x.trim()));

/**
 * D-429, D-433 (Appendix A): a composite is any card with `### Pieces`, whatever its id letter, and a card `r<k>-s-<n>` is
 * one. Its Pieces table sits in its brainstorm half, with the columns Key, Piece, Kind, Status, Where, Why, From: each
 * row a piece key (an Ideas line's id or a card link's), once; a piece; its kind, with ", under-played" for one so
 * marked; in, scheduled or out; where it goes, `—` for an out piece; why, required for scheduled and out; its sources.
 * Once the card counts as verified (`verifiedCard`: its structure check holds more than `Not checked yet.`, or R1b passed
 * on it), its verification half's `### Pieces measured` is a table, columns Key, Drops, How: at most 4 rows (the
 * leave-one-out probes), each a key of its Pieces table, its Drops each figure that moves (`<group> (<clear | per corpse
 * | boss>) −<x>%`), an estimate, or `not measured (<why>)`. Before that, it may hold only `Not checked yet.`, as
 * R1a-synthesize writes it. A plain card has neither table.
 */
function checkPieceTables(stages, cardIds, cardOf, fail, ctx = { heldCard: () => false, verdictOf: () => null }) {
  const KIND = new RegExp(`^(?:${PIECE_KINDS.join('|')})(?:,\\s*under-played)?$`);
  const KEY = new RegExp(`^${PIECE_KEY}$`);
  for (const id of [...cardIds].sort()) {
    const card = cardOf(id);
    const p = card.pieces;
    const m = card.measured;
    const bad = (line, why) => fail('pieces', `cards/${id}.md:${line}: ${why}`);
    if (p === null) {
      if (COMPOSITE_CARD.test(id)) fail('pieces', `cards/${id}.md is a composite's card (r<k>-s-<n>), but has no "### Pieces"; a composite lists every piece it took, in, scheduled or out, in its brainstorm half (D-429, D-433)`);
      if (m !== null && !m.pending) bad(m.line, `"### Pieces measured" on a card with no "### Pieces"; only a composite measures its pieces (D-433)`);
      continue;
    }
    if (p.h2 !== 'Brainstorm half') bad(p.line, `"### Pieces" is under ${p.h2 === null ? 'no H2' : show(p.h2)}; it is a heading of the card's brainstorm half, after "### Risks so far" (D-433)`);
    if (show(p.header) !== show(PIECES_COLUMNS) || !p.ruled) {
      bad(p.line, `the Pieces table's columns are ${show(p.header)}; they are ${show(PIECES_COLUMNS)}, in that order, with the |---| row under them (Appendix A)`);
      continue;
    }
    if (p.rows.length === 0) bad(p.line, 'the Pieces table has no row; a composite lists every piece it took, in, scheduled or out (D-429)');
    const keys = new Map();
    for (const r of p.rows) {
      const what = `the Pieces row ${show(r.key)}${emptyCell(r.piece) ? '' : ` (${r.piece})`}`;
      if (r.cells.length !== PIECES_COLUMNS.length) {
        bad(r.line, `${what} has ${r.cells.length} cells; a row has ${PIECES_COLUMNS.length} (Appendix A)`);
        continue;
      }
      if (!KEY.test(r.key)) bad(r.line, `${what}: its key isn't an Ideas line's id i<k><letter>-<m> or a card link's c<card id>-<m> (Appendix A)`);
      else if (keys.has(r.key)) bad(r.line, `${what} repeats the key of line ${keys.get(r.key)}; lines naming one piece merge into one row (Appendix A)`);
      keys.set(r.key, r.line);
      if (emptyCell(r.piece)) bad(r.line, `${what} names no piece (Appendix A)`);
      if (!KIND.test(r.kind)) bad(r.line, `${what}'s kind is ${show(r.kind)}; one of ${PIECE_KINDS.join(', ')}, with ", under-played" for a piece so marked (Appendix A)`);
      if (!PIECE_STATUSES.includes(r.status)) bad(r.line, `${what}'s status is ${show(r.status)}; in, scheduled or out (D-429)`);
      else if (r.status === 'out' ? !emptyCell(r.where) : emptyCell(r.where)) bad(r.line, r.status === 'out' ? `${what} is out, but its Where is ${show(r.where)}; an out piece's Where is — (Appendix A)` : `${what} is ${r.status} with no Where: the slot, group, set or node it takes (Appendix A)`);
      if (['scheduled', 'out'].includes(r.status) && emptyCell(r.why)) bad(r.line, `${what} is ${r.status} with no reason in Why; a scheduled or out piece says why (D-429, Appendix A)`);
      if (emptyCell(r.from)) bad(r.line, `${what} names no source in From: the cards and Ideas lines it came from (Appendix A)`);
    }
    if (m === null || m.pending) {
      if (verifiedCard(card, stages, id)) fail('pieces', `cards/${id}.md ${m === null ? 'has no "### Pieces measured"' : 'holds only "Not checked yet." under "### Pieces measured"'}, but R1b verified ${id} (${card.structure?.checked ? 'its structure check is written' : 'R1b passed on it'}); R1b measures each piece inside its composite, in the card's verification half after "### Key item prices" (D-433)`);
      continue;
    }
    if (m.h2 !== 'Verification half') bad(m.line, `"### Pieces measured" is under ${m.h2 === null ? 'no H2' : show(m.h2)}; it is a heading of the card's verification half, after "### Key item prices" (D-433)`);
    // D-436 (amendment 11, §19): a card verified under amendment 11's rules answers whether each piece does something;
    // a table written before the stamp is read by its columns.
    if (m.a11 === true || ctx.heldCard(id)) {
      a11Measured(id, p, m, keys, ctx.verdictOf(id), bad);
      continue;
    }
    if (show(m.header) !== show(MEASURED_COLUMNS) || !m.ruled) {
      bad(m.line, `the Pieces measured table's columns are ${show(m.header)}; they are ${show(MEASURED_COLUMNS)}, in that order, with the |---| row under them (Appendix A)`);
      continue;
    }
    if (m.rows.length > LEAVE_ONE_OUT) bad(m.line, `the Pieces measured table holds ${m.rows.length} rows; R1b leaves out at most ${LEAVE_ONE_OUT} pieces, and pieces not probed are left out of the table (D-433)`);
    const measured = new Set();
    for (const r of m.rows) {
      const what = `the Pieces measured row ${show(r.key)}`;
      if (r.cells.length !== MEASURED_COLUMNS.length) {
        bad(r.line, `${what} has ${r.cells.length} cells; a row has ${MEASURED_COLUMNS.length} (Appendix A)`);
        continue;
      }
      if (!keys.has(r.key)) bad(r.line, `${what} is no key of the card's Pieces table (D-433)`);
      else if (measured.has(r.key)) bad(r.line, `${what} is measured twice; each piece is left out once (D-433)`);
      measured.add(r.key);
      if (!dropsOk(r.drops)) bad(r.line, `${what}'s Drops is ${show(r.drops)}; each figure that moves, "<group> (<clear | per corpse | boss>) −<x>%", separated by "; ", or "estimate (<reason>)" for a piece PoB doesn't model, or "not measured (<why>)" (D-433, Appendix A)`);
    }
  }
}

/**
 * D-436, D-433 (amendment 11, Appendix A, §14): a Pieces measured table under amendment 11's rules, `| Key | Left out by |
 * Does something |`: at most 4 rows, each the key of an `in` row of the card's Pieces table (a probe on a scheduled or
 * out row fails), how the probe left it out, and its answer, `yes`, `no`, `PoB can't see it` or `not measured (<why>)`.
 * Where its last passing R1b verdict lists the drops (`pieces: [{key, figure, dropPercent}]`), `yes` is a piece one of
 * whose figures moves by 1% or more, and `no` one whose figures move less.
 */
function a11Measured(id, p, m, keys, verdict, bad) {
  if (show(m.header) !== show(MEASURED_COLUMNS_A11) || !m.ruled) {
    bad(m.line, `the Pieces measured table's columns are ${show(m.header)}; a card verified under amendment 11's rules (skillRevision ${A11}) has ${show(MEASURED_COLUMNS_A11)}, in that order, with the |---| row under them; the drops go in R1b's verdict file (D-436, Appendix A)`);
    return;
  }
  if (m.rows.length > LEAVE_ONE_OUT) bad(m.line, `the Pieces measured table holds ${m.rows.length} rows; R1b leaves out at most ${LEAVE_ONE_OUT} pieces, and pieces not probed are left out of the table (D-433)`);
  const status = new Map(p.rows.map((r) => [r.key, r.status]));
  const drops = Array.isArray(verdict?.pieces) ? verdict.pieces.filter((x) => isObj(x) && typeof x.key === 'string' && isNum(x.dropPercent)) : [];
  const measured = new Set();
  for (const r of m.rows) {
    const what = `the Pieces measured row ${show(r.key)}`;
    if (r.cells.length !== MEASURED_COLUMNS_A11.length) {
      bad(r.line, `${what} has ${r.cells.length} cells; a row has ${MEASURED_COLUMNS_A11.length} (Appendix A)`);
      continue;
    }
    if (!keys.has(r.key)) bad(r.line, `${what} is no key of the card's Pieces table (D-433)`);
    else if (status.get(r.key) !== 'in') bad(r.line, `${what} probes a ${status.get(r.key)} piece; R1b leaves out only the Pieces table's in rows (D-433, §14)`);
    if (measured.has(r.key)) bad(r.line, `${what} is measured twice; each piece is left out once (D-433)`);
    measured.add(r.key);
    if (!DOES_SOMETHING.test(r.answer)) bad(r.line, `${what}'s answer is ${show(r.answer)}; it is yes (leaving it out moves one of its figures by 1% or more), no, PoB can't see it, or not measured (<why>) (D-436)`);
    if (emptyCell(r.leftOutBy) && !/^not measured\b/.test(r.answer) && !/^PoB can/.test(r.answer)) bad(r.line, `${what} says nothing in Left out by: how the probe left the piece out (Appendix A)`);
    const mine = drops.filter((x) => x.key === r.key);
    if (mine.length > 0 && ['yes', 'no'].includes(r.answer)) {
      const moves = mine.some((x) => Math.abs(x.dropPercent) >= 1);
      if ((r.answer === 'yes') !== moves) bad(r.line, `${what} answers ${r.answer}, but R1b's verdict file gives its drops as ${mine.map((x) => `${x.figure ?? '?'} ${pct1(x.dropPercent)}%`).join(', ')}: a piece does something when leaving it out moves one of its figures by 1% or more (D-436)`);
    }
  }
}

/**
 * D-405: the user's note for brainstorm round `k`: round 1 starts with the run and has none; round k ≥ 2 is opened
 * by the (k−1)-th `more` answer at the brainstorm or verification gate, whose `note` it is (D-391).
 */
function roundNotes(log) {
  const mores = list(log.checkpoints).filter((c) => ['brainstorm', 'verification'].includes(c.checkpoint) && c.answer === 'more');
  return (k) => (k >= 2 ? mores[k - 2]?.note : undefined);
}

/**
 * D-408: the card each rival step that wrote one (`RV`, outcome `done`) wrote, by its log entry: `r<k>-x-<n>`, k the
 * brainstorm rounds run before it, n counting the run's rivals that wrote a card in round k.
 */
function rivalCards(stages) {
  const out = new Map();
  const perRound = new Map();
  let k = 0;
  stages.forEach((s, i) => {
    if (!isObj(s)) return;
    if (s.stage === 'R1a' && stages[i - 1]?.stage !== 'R1a') k += 1;
    if (s.stage === 'RV' && s.outcome === 'done') {
      const n = (perRound.get(k) ?? 0) + 1;
      perRound.set(k, n);
      out.set(s, `r${k}-x-${n}`);
    }
  });
  return out;
}

/**
 * D-408: each rival step that wrote its card (`done`) has it, `cards/r<k>-x-<n>.md`, and every rival's card has its step.
 * D-443: a card the rival wrote in the entries held to amendment 11 (from `heldStage` on) is one more than such a run deals.
 */
function checkRivals(stages, cardIds, fail, heldStage = Infinity) {
  const written = rivalCards(stages);
  stages.forEach((s, i) => {
    const id = written.get(s);
    if (id !== undefined && !cardIds.has(id)) fail('rival', `run-log.json stages[${i}] (RV attempt ${s.attempt}) wrote the rival's card, but cards/${id}.md doesn't exist; the rival writes one card, cards/r<k>-x-<n>.md, k the latest brainstorm round and n counting the run's rivals in it (D-408)`);
    if (id !== undefined && i >= heldStage && cardIds.has(id)) fail('rival', `cards/${id}.md is the rival's card, written in the entries held to amendment 11, which never deals an x card (D-443)`);
  });
  const ids = new Set(written.values());
  for (const id of cardIds) {
    if (RIVAL_CARD.test(id) && !ids.has(id)) fail('rival', `cards/${id}.md is a rival's card, but run-log.json logs no RV step that wrote it (outcome done; D-408)`);
  }
}

/**
 * D-403, D-406: the obvious card's pitch line `- Obvious build: <the kit it follows>` is on one card, r1-a-1, and only
 * when the brief names a skill or a playstyle; a card's `### Structure check` sits in its verification half, and its
 * `- A stronger structure? …` line, when it has one, is the section's last.
 */
function checkCardLines(log, cardIds, readText, fail) {
  const brief = isObj(log.brief) ? log.brief : {};
  const obviousBrief = (typeof brief.skill === 'string' && brief.skill.trim() !== '') || (Array.isArray(brief.playstyle) && brief.playstyle.length > 0);
  for (const id of [...cardIds].sort()) {
    const card = parseCard(readText(`cards/${id}.md`));
    const obvious = card.fields.get('Obvious build');
    if (obvious !== undefined) {
      if (id !== 'r1-a-1') fail('card', `cards/${id}.md:${obvious.line}: carries "- Obvious build:", but only the obvious card, r1-a-1 (researcher a's first card in round 1), does (D-403)`);
      else if (!obviousBrief) fail('card', `cards/${id}.md:${obvious.line}: carries "- Obvious build:", but the brief names neither a skill nor a playstyle, so the run has no obvious card (D-403)`);
      if (obvious.value.trim() === '') fail('card', `cards/${id}.md:${obvious.line}: "- Obvious build:" names no kit; it is "- Obvious build: <the kit it follows>" (D-403)`);
    }
    const sc = card.structure;
    if (sc === null) continue;
    if (sc.h2 !== 'Verification half') fail('card', `cards/${id}.md:${sc.line}: "### Structure check" is under ${sc.h2 === null ? 'no H2' : show(sc.h2)}; it is a heading of the card's verification half (D-406)`);
    if (!sc.strongerLast) fail('card', `cards/${id}.md:${sc.strongerLine}: "- A stronger structure? …" isn't the structure check's last line; it ends the section (D-406)`);
  }
}

/**
 * D-389, D-391: the cards changed and made at the gates, against the checkpoints that asked for them. A card a
 * brainstorm `pick:` or a verification `verify:` changed (`changes`) carries `- Changed at the gate (visit <v>):
 * <the user's words>` under its Pitch once R1b ran for it. A card made at a gate (`newCards`) is made once; once
 * R1b ran for it, its file carries `- Made at the gate (visit <v>): from <name> and <name>: <the user's words>`;
 * once an R1b-assemble ran after that, the deck holds its line under its round, marked "made at the gate". Every
 * card r<k>-g-<n> the run holds was made by a checkpoint.
 */
function checkGateCards(log, cardIds, readCard, deckText, fail) {
  const stages = list(log.stages);
  const ran = (id) => stages.map((s, i) => ({ s, i })).filter(({ s }) => s.stage === 'R1b' && s.concept === id && s.outcome !== 'missing').map(({ i }) => i);
  const deck = parseDeck(deckText);
  const made = new Map();
  list(log.checkpoints).forEach((c, ci) => {
    const at = `run-log.json checkpoints[${ci}] (${c.checkpoint} visit ${c.visit})`;
    const a = String(c.answer);
    // A verification pick:<id>'s changes go to D1-build as findings; the card itself isn't edited (D-391).
    const toR1b = (c.checkpoint === 'brainstorm' && a.startsWith('pick:')) || (c.checkpoint === 'verification' && a.startsWith('verify:'));
    if (toR1b && isObj(c.changes)) {
      for (const id of Object.keys(c.changes)) {
        if (ran(id).length === 0 || !cardIds.has(id)) continue;
        if (!readCard(id).changed.some((g) => g.visit === c.visit)) {
          fail('gate-card', `cards/${id}.md has no "- Changed at the gate (visit ${c.visit}): <the user's words>" line under its Pitch, but ${at} changed it and R1b ran for it; R1b writes that line, then the change (D-391)`);
        }
      }
    }
    for (const n of list(c.newCards)) {
      if (typeof n.id !== 'string') continue;
      if (made.has(n.id)) fail('gate-card', `${at} makes ${n.id}, which ${made.get(n.id).at} made already; a new card is made once (D-391)`);
      else made.set(n.id, { at, visit: c.visit, gate: c.checkpoint });
    }
  });
  for (const [id, m] of made) {
    const r1b = ran(id);
    if (r1b.length === 0) continue;
    if (!cardIds.has(id)) {
      fail('gate-card', `cards/${id}.md is missing, but R1b ran for ${id}, which ${m.at} made; R1b writes a gate-made card's brainstorm half first (D-391)`);
      continue;
    }
    if (!readCard(id).made.some((g) => g.visit === m.visit)) {
      fail('gate-card', `cards/${id}.md has no "- Made at the gate (visit ${m.visit}): from <name> and <name>: <the user's words>" line under its Pitch, but ${m.at} made it; R1b writes that line with the card's brainstorm half (D-391)`);
    }
    const k = Number(GATE_CARD.exec(id)?.[1]);
    const assembled = stages.some((s, i) => i > r1b[0] && s.stage === 'R1b-assemble' && s.outcome !== 'missing');
    const line = deck.entries.find((d) => d.id === id && d.round === k);
    if (assembled && (line === undefined || line.made === null)) {
      fail('deck', `cards.md holds no line for ${id} under "Round ${k}" marked "${MADE_MARK}", but ${m.at} made it and R1b-assemble ran after its R1b; R1b-assemble adds it there (D-391)`);
    }
  }
  for (const id of cardIds) {
    if (GATE_CARD.test(id) && !made.has(id)) fail('gate-card', `cards/${id}.md is a card made at a gate, but no checkpoint's newCards makes it (D-391)`);
  }
  for (const d of deck.entries) {
    if (GATE_CARD.test(d.id) && !made.has(d.id)) fail('deck', `cards.md:${d.n}: lists ${d.id}, a card made at a gate, but no checkpoint's newCards makes it (D-391)`);
  }
}

/**
 * D-389, D-390: the interview notes and the gate question reports, against the log. `interviews/<gate>-<visit>.md`
 * holds one H2 `Q<n>: <the user's question>` per question, numbered from 1, each with its `Answer:` (at most three
 * lines) and its `Source:`; its count is the visit's checkpoint's `questions` (no file and no count are 0). A gate
 * question step writes `interviews/<gate>-<visit>-q<n>.md`, numbered from 1 per visit, with `- Asked:`, `- Agent:`
 * and the H2s `Answer` and `Sources`; the visit's notes cite it as a source, and the log's `Q` entries count them.
 */
function checkInterviews(log, files, readText, exists, questionProbes, fail) {
  const notes = new Map();
  const reports = new Map();
  for (const f of files) {
    const m = INTERVIEW_FILE.exec(f);
    if (!m) {
      fail('layout', `interviews/${f} isn't an interview note interviews/<gate>-<visit>.md or a gate question's report interviews/<gate>-<visit>-q<n>.md (D-389, D-390)`);
      continue;
    }
    const key = `${m[1]}-${m[2]}`;
    if (m[3] === undefined) notes.set(key, f);
    else {
      if (!reports.has(key)) reports.set(key, []);
      reports.get(key).push(Number(m[3]));
    }
  }
  const displays = list(log.displays);
  const visited = (key) => displays.some((d) => `${d.checkpoint}-${d.visit}` === key);
  const cited = new Map();
  // The visit's notes: the questions, in order, each with its answer and its source.
  const counts = new Map();
  for (const [key, f] of notes) {
    const rel = `interviews/${f}`;
    if (!visited(key)) fail('interview', `${rel} is the notes of ${key.replace(/-(\d+)$/, ' visit $1')}, but displays[] records no such visit; the notes are a gate visit's (D-389)`);
    const lines = (readText(rel) ?? '').split('\n');
    const qs = [];
    // D-420: the restated decision waiting for the user's yes, `## Pending decision`, is no question: its block is
    // exempt from the question rules and the count, at a visit with questions or without.
    let pending = false;
    lines.forEach((l, i) => {
      if (/^##\s/.test(l)) {
        const head = l.replace(/^##\s+/, '').trim();
        pending = head === PENDING_DECISION;
        if (!pending) qs.push({ head, n: i + 1, body: [] });
      } else if (!pending && qs.length > 0 && !/^#\s/.test(l)) qs[qs.length - 1].body.push({ raw: l, n: i + 1 });
    });
    qs.forEach((q, k) => {
      const head = /^Q([1-9]\d*):\s*(\S.*)$/.exec(q.head);
      if (!head || Number(head[1]) !== k + 1) fail('interview', `${rel}:${q.n}: the H2 ${show(q.head)} isn't "Q${k + 1}: <the user's question>"; each question is an H2 Q<n>, numbered from 1 (D-389)`);
      const body = q.body.map((l) => l.raw.trim());
      const answerAt = body.findIndex((l) => /^Answer:\s*\S/.test(l));
      const sourceAt = body.findIndex((l) => /^Source:\s*\S/.test(l));
      if (answerAt < 0 || sourceAt < 0) {
        fail('interview', `${rel}:${q.n}: question ${k + 1} has no ${answerAt < 0 ? '"Answer: …"' : '"Source: …"'} line; each question gets its answer, in at most three lines, and its source: a file, a lookup, or a gate question step's report (D-389)`);
        return;
      }
      const answer = body.slice(answerAt, sourceAt > answerAt ? sourceAt : undefined).filter((l) => l !== '');
      if (sourceAt < answerAt || answer.length > 3) fail('interview', `${rel}:${q.n}: question ${k + 1}'s answer runs ${answer.length} lines${sourceAt < answerAt ? ', after its source' : ''}; it is at most three lines, then its "Source:" (D-389)`);
      const source = body.slice(sourceAt).filter((l) => l !== '').join(' ');
      for (const r of source.matchAll(/interviews\/([a-z]+-[1-9]\d*-q[1-9]\d*\.md)/g)) {
        if (!exists(`interviews/${r[1]}`)) fail('interview', `${rel}:${q.n}: question ${k + 1} cites interviews/${r[1]}, which doesn't exist (D-390)`);
        if (!cited.has(r[1])) cited.set(r[1], key);
      }
    });
    counts.set(key, qs.length);
  }
  // Each gate visit's checkpoint counts the questions its notes hold (D-389).
  list(log.checkpoints).forEach((c, i) => {
    if (!DISPLAYED.includes(c.checkpoint)) return;
    const key = `${c.checkpoint}-${c.visit}`;
    const want = isInt(c.questions) ? c.questions : 0;
    const got = counts.get(key) ?? 0;
    if (want !== got) {
      fail('interview', `run-log.json checkpoints[${i}]: ${c.checkpoint} visit ${c.visit} counts ${want} question(s), but ${notes.has(key) ? `interviews/${notes.get(key)} holds ${got}` : `there is no interviews/${key}.md`}; the checkpoint's questions are the visit's interview notes, one H2 Q<n> per question (D-389)`);
    }
  });
  // The gate question reports (D-390): numbered from 1 per visit, each cited by its visit's notes, in its form.
  let total = 0;
  for (const [key, ns] of reports) {
    ns.sort((a, b) => a - b);
    total += ns.length;
    if (ns.some((n, k) => n !== k + 1)) fail('interview', `interviews/ holds the gate question reports ${ns.map((n) => `${key}-q${n}.md`).join(', ')}; they are numbered from 1 per visit, with no gap (D-390)`);
    for (const n of ns) {
      const f = `${key}-q${n}.md`;
      if (cited.get(f) !== key) fail('interview', `interviews/${f} is a gate question step's report, but ${notes.has(key) ? `interviews/${notes.get(key)} doesn't cite it` : `there is no interviews/${key}.md to cite it`} as a question's source (D-389, D-390)`);
      const t = readText(`interviews/${f}`) ?? '';
      const h2 = t.split('\n').filter((l) => /^##\s/.test(l)).map((l) => l.replace(/^##\s+/, '').trim());
      const agent = /^- Agent:\s*(\S+)/m.exec(t)?.[1];
      if (!/^- Asked:\s*\S/m.test(t) || !['build-guide-researcher', 'build-guide-coordinator'].includes(agent) || show(h2) !== show(['Answer', 'Sources'])) {
        fail('interview', `interviews/${f} isn't a gate question's report: it has "- Asked: <the question>", "- Agent: build-guide-researcher | build-guide-coordinator", then the H2s Answer and Sources (D-390)`);
      }
    }
  }
  const logged = list(log.stages).filter((s) => s.stage === 'Q' && s.outcome !== 'missing').length;
  if (logged !== total) fail('interview', `run-log.json logs ${logged} gate question step(s) (stage Q), but interviews/ holds ${total} gate question report(s) <gate>-<visit>-q<n>.md; each step writes one (D-390)`);
  for (const q of questionProbes) {
    if (!exists(q.report)) fail('layout', `probes/${q.dir}/ is a gate question step's variant, but ${q.report}, its report, doesn't exist (D-390)`);
  }
}

/**
 * D-355, templates/dossier-template.md: the dossier is the verification gate's comparison table: one H1, then a
 * `Brief:` line, then one table with `DOSSIER_COLUMNS`, one row `| <id> | …` per card R1b verified before the last
 * assembly, and no H2, H3 or marker. A failed or not-yet-finalizable card has `—` in its number, price and league
 * cells. Amendment 8: the columns are `DOSSIER_COLUMNS_D407`, with each card's rough clear speed (D-407); a run
 * that didn't run the rival (`ctx.rivalRan`), recorded before it, may keep `DOSSIER_COLUMNS`. The rival's row comes
 * from R1b-assemble's second pass (D-408). A card whose R1b ended not-in-pin reads "can't be finalized yet: waits
 * on the pin" (D-400), and the rival's card whose R1b ended not-dealt "failed …: not dealt …" (D-408).
 */
function checkDossier(text, assembled, ID, fail, ctx = { rivalRan: false, terminal: new Map(), composite: false }) {
  const bad = (why) => fail('dossier-sections', `dossier.md${why}`);
  // An HTML comment (the template's, left in) is no part of the dossier: blanked, its lines kept for the numbering.
  const md = parseMarkdown(String(text).replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')));
  const h1 = md.headings.filter((h) => h.level === 1);
  if (h1.length !== 1) bad(` has ${h1.length} H1s; it has one, then the Brief: line and the comparison table (§7.2, D-355)`);
  for (const h of md.headings.filter((x) => x.level > 1)) bad(`:${h.line + 1} has the heading ${show(h.title)}; the dossier is one table, with no H2 or H3 (§7.2, D-355)`);
  if (md.markers.length > 0 || md.definitions.length > 0) bad(` carries source markers ([^…]); the dossier's numbers are the cards' records' and its prices their skeletons' entries, with no marker (D-355)`);
  const body = md.lines.map((raw, i) => ({ raw: raw.trim(), n: i + 1 })).filter((l) => l.raw !== '' && !(h1[0] && l.n === h1[0].line + 1));
  if (!body[0] || !body[0].raw.startsWith('Brief:')) bad(` doesn't start with the "Brief:" line after its H1 (templates/dossier-template.md)`);
  const tables = [];
  body.forEach((l, k) => {
    if (!l.raw.startsWith('|')) return;
    if (k === 0 || !body[k - 1].raw.startsWith('|') || body[k - 1].n !== l.n - 1) tables.push([]);
    tables[tables.length - 1].push({ ...l, cells: l.raw.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()) });
  });
  const wanted = ctx.a11 ? DOSSIER_COLUMNS_A11 : ctx.composite ? DOSSIER_COLUMNS_D433 : DOSSIER_COLUMNS_D407;
  if (tables.length !== 1) {
    bad(` holds ${tables.length} tables; it holds one, the verification gate's comparison, with the columns ${wanted.join(' | ')} (D-355, D-407${ctx.a11 ? ', D-436' : ctx.composite ? ', D-433' : ''})`);
    if (tables.length === 0) return;
  }
  const [head, rule, ...rows] = tables[0];
  // D-436 (amendment 11, §19): a dossier written under amendment 11's rules has its nine columns, no number among them.
  // Before it, D-433: a composite run's twelve columns, `key pieces` last. D-407: amendment 8's eleven; a dossier from
  // before it (a run that didn't run the rival) may keep D-355's ten.
  const columns = ctx.a11 ? (show(head.cells) === show(DOSSIER_COLUMNS_A11) ? DOSSIER_COLUMNS_A11 : null)
    : ctx.composite ? (show(head.cells) === show(DOSSIER_COLUMNS_D433) ? DOSSIER_COLUMNS_D433 : null)
      : show(head.cells) === show(DOSSIER_COLUMNS_D407) ? DOSSIER_COLUMNS_D407 : !ctx.rivalRan && show(head.cells) === show(DOSSIER_COLUMNS) ? DOSSIER_COLUMNS : null;
  if (columns === null || !rule?.cells.every((c) => /^:?-+:?$/.test(c))) {
    if (ctx.a11) bad(`:${head.n}: the table's columns are ${show(head.cells)}; a dossier written under amendment 11's rules (skillRevision ${A11}) has ${show(DOSSIER_COLUMNS_A11)}, in that order: no number column, the damage kinds PoB shows and the pieces that do something instead (D-436, §19)`);
    else if (ctx.composite) bad(`:${head.n}: the table's columns are ${show(head.cells)}; a composite run's comparison has twelve, ${show(DOSSIER_COLUMNS_D433)}, in that order, its last each composite's measured pieces and their largest drops (D-355, D-407, D-433)`);
    else bad(`:${head.n}: the table's columns are ${show(head.cells)}; the comparison's are ${show(DOSSIER_COLUMNS_D407)}, in that order (D-355, D-407)${ctx.rivalRan ? ', in a run that ran the rival (D-408)' : `, or before amendment 8 ${show(DOSSIER_COLUMNS)}`}`);
    return;
  }
  const seen = new Set();
  for (const r of rows) {
    const id = r.cells[0];
    if (r.cells.length !== columns.length || !ID.test(id)) {
      bad(`:${r.n}: the row ${show(r.raw.length > 60 ? `${r.raw.slice(0, 57)}...` : r.raw)} isn't "| <id> | …" with ${columns.length} cells`);
      continue;
    }
    if (seen.has(id)) bad(`:${r.n}: ${id} has a second row; one row per verified card`);
    seen.add(id);
    if (!assembled.includes(id)) bad(`:${r.n}: has a row for ${id}, which no R1b verified before the last R1b-assemble; one row per verified card (D-355)`);
    const status = r.cells[columns.indexOf('Status')];
    if (/^(failed|can['’]t be finalized)/i.test(status)) {
      const filled = DOSSIER_EMPTY_CELLS.filter((c) => columns.includes(c) && !isDash(r.cells[columns.indexOf(c)]));
      if (filled.length > 0) bad(`:${r.n}: ${id} is ${show(status.split(/[:;]/)[0])}, but its ${filled.join(', ')} cell(s) aren't "—"; a failed or not-yet-finalizable card has no numbers, prices or league (templates/dossier-template.md)`);
    }
    // D-400, D-408: the status of a card whose R1b ended with no compile on an entry the pin lacks, or the rival's checks.
    const code = ctx.terminal?.get(id);
    if (columns === DOSSIER_COLUMNS_A11) a11Row(r, id, status, columns, ctx, bad);
    if (code === 'not-in-pin' && !/^can['’]t be finalized yet: waits on the pin\b/i.test(status)) bad(`:${r.n}: ${id}'s R1b ended not-in-pin, so its status reads "can't be finalized yet: waits on the pin", not ${show(status)} (D-400)`);
    if (code === 'not-dealt' && !/^failed\b.*\bnot dealt\b/i.test(status)) bad(`:${r.n}: ${id}'s R1b ended not-dealt, so its status reads "failed …: not dealt: <the check it failed>", not ${show(status)} (D-408)`);
  }
  for (const id of assembled) if (!seen.has(id)) bad(` has no row "| ${id} | …" for ${id}, which R1b verified before the last R1b-assemble (§7.2, D-355)`);
}

/**
 * D-436 (amendment 11, Appendix A): an amendment-11 dossier row. Its Status is `viable`, `viable, except <what>`,
 * `failed after <N> attempts: …` or `can't be finalized yet: …`; a viable card's `Damage` names the named source and the
 * kinds PoB shows, and a failed or not-yet-finalizable card's is `—`; `Pieces` is a composite's count of the `in` pieces
 * probed that do something (`<n> of <m> do something`, or `<n> of <m>: <the pieces that don't>`) and `—` for a plain
 * card; and `viable, except` goes with a piece its card's Pieces measured answers `no`, and only with one.
 */
function a11Row(r, id, status, columns, ctx, bad) {
  const cell = (c) => r.cells[columns.indexOf(c)];
  if (!STATUS_A11.test(status)) bad(`:${r.n}: ${id}'s Status is ${show(status)}; it is viable, "viable, except <what>", "failed after <N> attempts: …" (a damage-missing failure among them) or "can't be finalized yet: …" (D-436)`);
  const viable = /^viable\b/i.test(status);
  if (viable && isDash(cell('Damage') ?? '-')) bad(`:${r.n}: ${id} is viable, but its Damage cell is ${show(cell('Damage'))}; it names the named source and the kinds of damage PoB shows for it ("Detonate Dead: hit, bleed, ignite") (D-436)`);
  // D-436: a source a meta gem triggers is rated by PoB at its hand-cast speed, and the dossier says so.
  else if (viable && typeof ctx.triggered === 'function' && ctx.triggered(id) && !/hand-cast/i.test(cell('Damage') ?? '')) bad(`:${r.n}: ${id}'s named source is triggered by a meta gem (its skeleton record's measures.trigger), but its Damage cell ${show(cell('Damage'))} doesn't say PoB rates it at its hand-cast speed: "<skill>: <kinds> (rated at its hand-cast speed)" (D-436)`);
  if (!viable && !isDash(cell('Pieces') ?? '-') && /^(failed|can['’]t be finalized)/i.test(status)) bad(`:${r.n}: ${id} is ${show(status.split(/[:;]/)[0])}, but its Pieces cell isn't "—"; a card that failed or can't be finalized yet probed no piece (D-436)`);
  const card = typeof ctx.cardOf === 'function' ? ctx.cardOf(id) : null;
  const composite = ctx.composites?.has?.(id) === true;
  const pieces = String(cell('Pieces') ?? '').trim();
  if (viable && !composite && !isDash(pieces || '-')) bad(`:${r.n}: ${id} is a plain card, but its Pieces cell is ${show(pieces)}; a plain card's is "—" (D-436)`);
  if (viable && composite) {
    const m = /^(\d+) of (\d+)(?: do something|: \S.*)$/.exec(pieces);
    if (!m || Number(m[1]) > Number(m[2])) bad(`:${r.n}: ${id}'s Pieces cell is ${show(pieces)}; it is "<n> of <m> do something", or "<n> of <m>: <piece> does nothing in PoB; <piece>: PoB can't see it", of the in pieces probed (D-436)`);
  }
  const table = card?.measured;
  if (viable && table?.a11 === true) {
    const nothing = table.rows.filter((x) => x.answer === 'no').map((x) => x.key);
    const except = /^viable, except\b/i.test(status);
    if (nothing.length > 0 && !except) bad(`:${r.n}: ${id} is ${show(status)}, but its Pieces measured answers no for ${nothing.join(', ')}; a card with a piece that does nothing in PoB is "viable, except <what>" (D-436)`);
    if (except && nothing.length === 0) bad(`:${r.n}: ${id} is ${show(status)}, but no row of its Pieces measured answers no; "viable, except" names a piece that does nothing in PoB (D-436)`);
  }
}

/** stages/V4.md: a finding's fields, in order; an `unresolved` one adds `reader`. */
const FINDING_FIELDS = ['status', 'hinge', 'owner', 'artifact', 'location', 'claim', 'issue', 'evidence'];
/** A `## Checked` item, as `--changed` prints it (D-352). */
const CHECKED_ITEM = /^(?:claim stages\[\d+\]\.claims\[\d+\] \(.+\)|section .+)$/;

/**
 * A V4 report, `reports/V4-<n>.md` (stages/V4.md), read by line: its H1, its `- <key>: <value>` fields, the items of
 * `## Checked`, and `## Findings`, `None.` or one `### <id>` per finding with its fields in order. `errors` lists the
 * lines outside the form.
 */
export function parseV4Report(text) {
  const out = { h1: null, fields: {}, checked: null, findings: null, none: false, errors: [] };
  let section = 'head';
  let finding = null;
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    // D-435: an empty list item (a stray "- ") is no line of the form; the verifier, who has no Edit, may leave one.
    if (line.trim() === '' || /^\s*[-*]$/.test(line)) return;
    const h = /^(#{1,6})\s+(.*?)$/.exec(line);
    const kv = /^- ([a-z]+):\s?(.*)$/.exec(line);
    if (h) {
      const [level, title] = [h[1].length, h[2].trim()];
      if (level === 1 && out.h1 === null && section === 'head') out.h1 = title;
      else if (level === 2 && title === 'Checked' && out.checked === null) [out.checked, section] = [[], 'checked'];
      else if (level === 2 && title === 'Findings' && out.findings === null) [out.findings, section, finding] = [[], 'findings', null];
      else if (level === 3 && section === 'findings' && !out.none) {
        finding = { id: title, fields: [], line: i + 1 };
        out.findings.push(finding);
      } else out.errors.push(`line ${i + 1}: the heading ${show(line)} isn't the form's (# V4-<n>: …, ## Checked, ## Findings, ### <id>)`);
    } else if (section === 'head') {
      if (kv && out.h1 !== null) out.fields[kv[1]] = kv[2].trim();
      else out.errors.push(`line ${i + 1}: ${show(line)} isn't a "- <key>: <value>" line under the H1`);
    } else if (section === 'checked') {
      const item = /^- (.+)$/.exec(line);
      if (item) out.checked.push(item[1].trim());
      else if (line.trim() !== 'None.') out.errors.push(`line ${i + 1}: ${show(line)} isn't a "- <item>" line of ## Checked`);
    } else if (finding === null) {
      if (line.trim() === 'None.' && out.findings.length === 0) out.none = true;
      else out.errors.push(`line ${i + 1}: ${show(line)} isn't "None." or a "### <id>" finding of ## Findings`);
    } else if (kv) finding.fields.push([kv[1], kv[2].trim()]);
    else out.errors.push(`line ${i + 1}: ${show(line)} isn't a "- <key>: <value>" line of finding ${finding.id}`);
  });
  return out;
}

/**
 * A V4 report against stages/V4.md and the log entry that wrote it (`r.entry`, the n-th logged pass): the H1
 * `# V4-<n>: full pass` (a V4 entry) or `# V4-<n>: re-check of rounds/<n-1>` (a V4-recheck entry); the fields
 * `check`, `concept` (the entry's card), `mode` (the run's) and `verdict` (`pass` exactly when no finding is
 * unresolved, the entry's outcome); `## Checked` items in `--changed`'s forms; each finding `v4-<n>-<k>` (a
 * full pass's all its own `<n>`) with its fields in order, `reader` on an unresolved one only. Returns
 * `{check, checked, findings}`, each finding its fields by name.
 */
function checkV4Report(r, mode, fail, ID) {
  const bad = (why) => fail('report-shape', `${r.file}: ${why}`);
  const rep = r.report;
  for (const e of rep.errors) bad(e);
  // D-415: V4's campaign pass, `# V4-<n>: campaign pass of rounds/<n-1>`, `check: campaign`. D-477 (amendment 13): a
  // file-only build's claims pass, `# V4-<n>: claims pass`, `check: claims`.
  const h1 = /^V4-([1-9]\d*): (?:(full pass)|re-check of rounds\/([1-9]\d*)|(campaign pass) of rounds\/([1-9]\d*)|(claims pass))$/.exec(rep.h1 ?? '');
  const of = h1 ? (h1[3] ?? h1[5]) : undefined;
  if (!h1 || Number(h1[1]) !== r.n || (of !== undefined && Number(of) !== r.n - 1)) {
    bad(`its H1 is ${show(rep.h1)}; it is "# V4-${r.n}: full pass" or "# V4-${r.n}: re-check of rounds/${r.n - 1}" (stages/V4.md), for V4's campaign pass "# V4-${r.n}: campaign pass of rounds/${r.n - 1}" (D-415), or for a file-only build's claims pass "# V4-${r.n}: claims pass" (D-477)`);
  }
  const check = h1 ? (h1[2] ? 'full' : h1[4] ? 'campaign' : h1[6] ? 'claims' : 'recheck') : rep.fields.check;
  if (rep.fields.check !== check || !['full', 'recheck', 'campaign', 'claims'].includes(check)) bad(`check is ${show(rep.fields.check ?? null)}; it is "full" or "recheck", as its H1 says (stages/V4.md), "campaign" for V4's campaign pass (D-415), or "claims" for a file-only build's claims pass (D-477)`);
  const entry = r.entry?.s;
  const KIND = { full: 'full pass', recheck: 're-check', campaign: 'campaign pass', claims: 'claims pass' };
  if (entry !== undefined) {
    const want = entry.stage === 'V4' ? 'full' : entry.stage === 'V4-campaign' ? 'campaign' : entry.stage === 'V4-claims' ? 'claims' : 'recheck';
    if (check !== want) fail('reports', `${r.file} is a ${KIND[check] ?? check}, but the V4 pass it is, run-log.json's V4 entry ${r.n} (${describe(entry)}), is a ${{ full: 'full pass (V4)', recheck: 're-check (V4-recheck)', campaign: 'campaign pass (V4-campaign)', claims: 'claims pass (V4-claims)' }[want]}; each pass writes its own report and never overwrites one (D-352, D-477)`);
    if (rep.fields.concept !== entry.concept) bad(`concept is ${show(rep.fields.concept ?? null)}, but the pass that wrote it, ${describe(entry)}, is about ${entry.concept}`);
  } else if (!ID.test(rep.fields.concept ?? '')) bad(`concept is ${show(rep.fields.concept ?? null)}; it is the guide's card`);
  if (rep.fields.mode !== mode) bad(`mode is ${show(rep.fields.mode ?? null)}; the run is ${show(mode)}`);
  if (!['pass', 'fail'].includes(rep.fields.verdict)) bad(`verdict is ${show(rep.fields.verdict ?? null)}; "pass" or "fail" (stages/V4.md)`);
  if (rep.checked === null) bad('has no "## Checked"; it lists what the pass checked (stages/V4.md)');
  else for (const item of rep.checked) if (!CHECKED_ITEM.test(item)) bad(`## Checked lists ${show(item)}, which is neither "claim stages[<i>].claims[<k>] (<id>)" nor "section <H2 title>" (D-352)`);
  // D-477: the claims pass reads no guide, the build having none: it lists claims only, and its findings are the plan's,
  // owned by D1, the fix round's one owner.
  if (check === 'claims') {
    for (const item of rep.checked ?? []) if (/^section /.test(item)) bad(`## Checked lists ${show(item)}, but a claims pass reads no guide; it checks the plan's hinge claims alone (D-477)`);
  }
  if (rep.findings === null) bad('has no "## Findings"; it holds one "### <id>" per finding, or "None." (stages/V4.md)');
  const statuses = !['full', 'claims'].includes(check) ? ['unresolved', 'accepted-offline', 'fixed'] : ['unresolved', 'accepted-offline'];
  const ids = new Set();
  const findings = [];
  for (const f of rep.findings ?? []) {
    const at = `finding ${f.id} (line ${f.line})`;
    const fields = Object.fromEntries(f.fields);
    const id = /^v4-([1-9]\d*)-([1-9]\d*)$/.exec(f.id);
    if (!id || Number(id[1]) > r.n || (['full', 'claims'].includes(check) && Number(id[1]) !== r.n)) bad(`${at}: its id isn't v4-<n>-<k>, <n> this pass's (${r.n}) for a new finding or an earlier report's for one reported again (D-352)`);
    if (check === 'claims' && (fields.owner !== 'D1' || fields.artifact !== 'plan.json')) bad(`${at} is owned by ${show(fields.owner ?? null)} in ${show(fields.artifact ?? null)}; a claims pass's findings are the plan's (plan.json), owned by D1, its fix round's one owner (D-477)`);
    if (ids.has(f.id)) bad(`${at} reuses its id; each finding has its own`);
    ids.add(f.id);
    const want = fields.status === 'unresolved' ? [...FINDING_FIELDS, 'reader'] : FINDING_FIELDS;
    const keys = f.fields.map(([k]) => k);
    if (show(keys) !== show(want)) bad(`${at} has the fields ${keys.join(', ')}; a${fields.status === 'unresolved' ? 'n unresolved' : ' fixed or accepted-offline'} finding has ${want.join(', ')}, in that order${fields.status === 'unresolved' ? ', reader the plain sentence the guide\'s reader can act on (D-265)' : ', and no reader'}`);
    if (!statuses.includes(fields.status)) bad(`${at}: status is ${show(fields.status ?? null)}; one of ${statuses.join(', ')}${check === 'full' ? ' (only a re-check reports fixed)' : ''}`);
    if (!['yes', 'no'].includes(fields.hinge)) bad(`${at}: hinge is ${show(fields.hinge ?? null)}; "yes" or "no", its triage (D-352)`);
    if (!OWNERS.includes(fields.owner)) bad(`${at}: owner is ${show(fields.owner ?? null)}; one of ${OWNERS.join(', ')}`);
    if (!ARTIFACTS.includes(fields.artifact)) bad(`${at}: artifact is ${show(fields.artifact ?? null)}; V4 checks ${ARTIFACTS.join(' and ')} (the dossier isn't verified, S3)`);
    if (fields.status === 'unresolved' && (fields.reader ?? '') === '') bad(`${at} is unresolved and has no reader: one plain sentence the guide's reader can act on (D-265)`);
    if (fields.status === 'accepted-offline' && mode !== 'offline') bad(`${at} is accepted-offline in an online run; only offline mode accepts external-unavailable (C-30)`);
    findings.push({ id: f.id, ...fields });
  }
  const unresolved = findings.filter((f) => f.status === 'unresolved').length;
  if (rep.fields.verdict === 'pass' && unresolved > 0) bad(`says verdict "pass" alongside ${unresolved} unresolved finding(s); pass means none is unresolved (stages/V4.md)`);
  if (rep.fields.verdict === 'fail' && unresolved === 0) bad('says verdict "fail" with no unresolved finding; pass means none is unresolved (stages/V4.md)');
  if (entry !== undefined && ['pass', 'fail'].includes(rep.fields.verdict) && entry.outcome !== rep.fields.verdict) {
    fail('reports', `run-log.json logs ${describe(entry)} ${show(entry.outcome)}, but its report ${r.file} says verdict ${show(rep.fields.verdict)}; a V4 entry's outcome is its report's (run-log.md)`);
  }
  return { check, checked: rep.checked ?? [], findings };
}

// ---------------------------------------------------------------------------------------------------
// The D1 gate, recomputed (gates.md; Q3)
// ---------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------
// Amendment 11's design field, trades and boss estimate (D-437…D-441, D-447, D-448; Appendix A)
// ---------------------------------------------------------------------------------------------------

/** D-439, Appendix A: a trade's kinds, and its fields in `trades.json`. */
const TRADE_KINDS_A11 = ['unmodelled', 'boots', 'defence', 'damage'];
const TRADE_FIELDS = ['stage', 'kind', 'what', 'ehpChange', 'damageChange', 'bossAfter', 'reason'];
/** D-441: a trade that found nothing says so, `none found: <why>`. */
const NONE_FOUND = /^none found: \S/;
const numOrNull = (v) => v === null || isNum(v);

/** The reference files of the skill (Appendix A): the toughness targets (D-441) and the boss floor (D-448); null when unreadable. */
function targetsOf(fail, where) {
  const t = referenceJson('toughness-targets.json');
  if (!isObj(t) || !isObj(t.targets) || !isNum(t.targets.close) || !isNum(t.targets.distance) || !isNum(t.under) || !isNum(t.over)) {
    fail('toughness', `${where}: references/toughness-targets.json can't be read as {rung, targets: {close, distance}, under, over, source} (D-441, Appendix A)`);
    return null;
  }
  return t;
}
function floorOf(fail, where) {
  const f = referenceJson('boss-floor.json');
  if (!isObj(f) || !isNum(f.floor)) {
    fail('boss-floor', `${where}: references/boss-floor.json can't be read as {rung, floor, source} (D-448, Appendix A)`);
    return null;
  }
  return f.floor;
}
/** D-441: the band of an EHP against its target: under below `under` × target, over above `over` × target, else within. */
export function bandOf(ehp, target, t) {
  if (ehp < t.under * target) return 'under';
  if (ehp > t.over * target) return 'over';
  return 'within';
}
/** Whether a figure the gate or D1-finish wrote stands for `value`: within 0.5% of it (or 0.01), whatever its rounding. */
const sameFigure = (written, value) => isNum(written) && isNum(value) && Math.abs(written - value) <= Math.max(0.005 * Math.abs(value), 0.01);

/**
 * Amendment 12 (D-450, Appendix A): a trade's kinds and fields in a build held to revision 12: the avoidance trade, and
 * `maxHit` and `hitsSurvived` on every entry, `null` where they don't apply.
 */
const TRADE_KINDS_A12 = [...TRADE_KINDS_A11, 'avoidance'];
const TRADE_FIELDS_A12 = [...TRADE_FIELDS, 'maxHit', 'hitsSurvived'];
/**
 * Amendment 13 (D-468, Appendix A): a build held to revision 13's trades: the kind `boss`, D1-tree's alternative tree
 * that keeps the start's boss figure, and on every entry `bossEntries` and `nodes`, null but on a boss trade.
 */
const TRADE_KINDS_A13 = [...TRADE_KINDS_A12, 'boss'];
const TRADE_FIELDS_A13 = [...TRADE_FIELDS_A12, 'bossEntries', 'nodes'];
/** D-450: a defence trade's reason names why it fires: a one-shot rung, or a rung under its toughness band (D-441). */
const DEFENCE_REASON = /^(?:one-shot by the Arbiter's [a-z][a-z -]* hit|under the toughness band)(?:; cuts .+ against a boss by [\d.]+%)?$/;

/**
 * D-439, Appendix A: `<buildFolder>/trades.json`, `{"trades": [{stage, kind, what, ehpChange, damageChange, bossAfter,
 * reason}]}`: each trade on an endgame rung of the plan, its kind `unmodelled`, `boots`, `defence` or `damage`, `what` a
 * short phrase (`none found: <why>` with null changes for a defence or damage trade that found none), its changes in
 * percent or null, and `bossAfter` a number only on the non-budget rung's damage trade. Amendment 12 (D-450, §22): a build
 * held to revision 12 (`a12`) has the 9 fields, `maxHit {type, before, after}` on a defence or damage entry and
 * `hitsSurvived {before, after}` on a defence or avoidance entry, each else null; the kind `avoidance`, and the defence
 * and avoidance trades on `b` or `n` only, a defence trade's reason `one-shot by the Arbiter's <type> hit` or `under the
 * toughness band`; `bossAfter`, measured on the trade's temporary stage (D-456), on a defence, damage or avoidance entry.
 * A build held to 11 keeps the 7 fields.
 */
function checkTradesFile(file, endgame, fail, a12 = false, a13 = false) {
  const bad = (why) => fail('trades', `trades.json${why}`);
  if (!isObj(file) || !Array.isArray(file.trades) || Object.keys(file).length !== 1) return bad(` is ${show(file).slice(0, 80)}; it is {"trades": [...]} (D-439, Appendix A)`);
  const rungs = new Map(endgame.map((s) => [s.id, s.variant]));
  const [fields, kinds] = a13 ? [TRADE_FIELDS_A13, TRADE_KINDS_A13] : a12 ? [TRADE_FIELDS_A12, TRADE_KINDS_A12] : [TRADE_FIELDS, TRADE_KINDS_A11];
  file.trades.forEach((t, k) => {
    const at = `'s trades[${k}]`;
    if (!isObj(t) || show(Object.keys(t).sort()) !== show([...fields].sort())) return bad(`${at} is ${show(t)}; a trade is {${fields.join(', ')}}${a13 ? ' in a build held to revision 13, bossEntries and nodes null but on a boss trade (D-468, §22)' : a12 ? ' in a build held to revision 12, maxHit and hitsSurvived null where they don\'t apply (D-450, §22)' : ' (Appendix A)'}`);
    if (!rungs.has(t.stage)) bad(`${at} names stage ${show(t.stage)}, which is no endgame rung of the plan (D-439)`);
    if (!kinds.includes(t.kind)) bad(`${at}'s kind is ${show(t.kind)}; one of ${kinds.join(', ')} (Appendix A)`);
    if (typeof t.what !== 'string' || t.what.trim() === '') bad(`${at} has no what, the trade in a short phrase (Appendix A)`);
    if (typeof t.reason !== 'string') bad(`${at}'s reason is ${show(t.reason)}; a short phrase (Appendix A)`);
    if (!numOrNull(t.ehpChange) || !numOrNull(t.damageChange) || !numOrNull(t.bossAfter)) bad(`${at}'s changes are ${show([t.ehpChange, t.damageChange, t.bossAfter])}; ehpChange and damageChange are percentages or null, bossAfter a number or null (Appendix A)`);
    const none = NONE_FOUND.test(String(t.what ?? ''));
    if (none && (t.ehpChange !== null || t.damageChange !== null || t.bossAfter !== null || (a12 && (t.maxHit !== null || t.hitsSurvived !== null)))) bad(`${at} found none (${show(t.what)}), but its changes aren't null (Appendix A)`);
    if (!a12) {
      if (isNum(t.bossAfter) && !(t.kind === 'damage' && rungs.get(t.stage) === 'non-budget')) bad(`${at} has bossAfter on a ${t.kind} trade of ${t.stage}; only the non-budget rung's damage trade carries it (D-448, Appendix A)`);
      return;
    }
    const bn = ['budget', 'non-budget'].includes(rungs.get(t.stage));
    if (['defence', 'avoidance'].includes(t.kind) && rungs.has(t.stage) && !bn) bad(`${at} is a ${t.kind} trade on ${t.stage}; defence and avoidance trades are on b or n (D-450, Appendix A)`);
    if (t.kind === 'defence' && typeof t.reason === 'string' && !DEFENCE_REASON.test(t.reason.trim())) bad(`${at}'s reason is ${show(t.reason)}; a defence trade's reason is "one-shot by the Arbiter's <type> hit" or "under the toughness band" (D-450, Appendix A)`);
    // D-468 (amendment 13): a boss trade carries the alternative tree's boss figure, bossAfter, beside the defence, damage
    // and avoidance trades' (D-456).
    const bossKinds = a13 ? ['defence', 'damage', 'avoidance', 'boss'] : ['defence', 'damage', 'avoidance'];
    if (isNum(t.bossAfter) && !bossKinds.includes(t.kind)) bad(`${at} has bossAfter on a ${t.kind} trade; D1-finish measures it on a defence, damage or avoidance trade's temporary stage (D-456${a13 ? '), and D1-tree on a boss trade\'s alternative tree (D-468' : ''}, Appendix A)`);
    if (a13) {
      // D-468 (Appendix A): a boss trade's entries `[{label, before, after}]` and its nodes `{remove: [ids], add: [ids]}`
      // against the final tree, and its alternative tree's boss figure; every other trade's are null.
      const ids = (v) => Array.isArray(v) && v.every((x) => isInt(x, 1));
      const entriesOk = Array.isArray(t.bossEntries) && t.bossEntries.length > 0 && t.bossEntries.every((e) => isObj(e) && typeof e.label === 'string' && e.label.trim() !== '' && isNum(e.before) && isNum(e.after));
      const nodesOk = isObj(t.nodes) && show(Object.keys(t.nodes).sort()) === show(['add', 'remove']) && ids(t.nodes.remove) && ids(t.nodes.add);
      if (t.kind === 'boss') {
        if (!isNum(t.bossAfter)) bad(`${at} is a boss trade with bossAfter ${show(t.bossAfter)}; it carries the alternative tree's boss figure (D-468, Appendix A)`);
        if (!entriesOk) bad(`${at} is a boss trade with bossEntries ${show(t.bossEntries)}; it lists each boss-rotation entry's figure, [{label, before, after}] (D-468, Appendix A)`);
        if (!nodesOk) bad(`${at} is a boss trade with nodes ${show(t.nodes)}; it names the nodes to remove and add against the final tree, {remove: [ids], add: [ids]} (D-468, Appendix A)`);
      } else if (t.bossEntries !== null || t.nodes !== null) bad(`${at} is a ${t.kind} trade with bossEntries ${show(t.bossEntries)} and nodes ${show(t.nodes)}; only a boss trade carries them, null on every other trade (Appendix A)`);
    }
    const mh = t.maxHit;
    if (!(mh === null || (isObj(mh) && typeof mh.type === 'string' && mh.type !== '' && isNum(mh.before) && isNum(mh.after) && Object.keys(mh).length === 3))) bad(`${at}'s maxHit is ${show(mh)}; null, or {type, before, after}, the deciding row's Pinnacle-pass max hit (D-450, Appendix A)`);
    else if (mh !== null && !['defence', 'damage'].includes(t.kind)) bad(`${at} has maxHit on a ${t.kind} trade; it is set on a one-shot rung's defence and damage entries only (Appendix A)`);
    const hs = t.hitsSurvived;
    const pctOk = (v) => isNum(v) && v >= 0 && v <= 100;
    if (!(hs === null || (isObj(hs) && pctOk(hs.before) && pctOk(hs.after) && Object.keys(hs).length === 2))) bad(`${at}'s hitsSurvived is ${show(hs)}; null, or {before, after}, each 0–100 (D-450, Appendix A)`);
    else if (hs !== null && !['defence', 'avoidance'].includes(t.kind)) bad(`${at} has hitsSurvived on a ${t.kind} trade; it is set on the defence and avoidance entries of a build that evades or deflects (Appendix A)`);
  });
}

/** D-449 (§4; proceed-on, §25): the fix family a warning names for the type of a hit. */
export function fixFamily(type) {
  if (type === 'physical') return 'the pool, armour or a physical shift';
  if (type === 'physical-lightning') return 'the pool, armour, a physical shift or lightning resistance';
  return `the pool or ${typeWords(type)} resistance`;
}

/** §6, Appendix A: the defence plan's base families, those of the bases' attributes. */
const DEFENCE_BASES = ['armour', 'evasion', 'energy shield', 'armour/evasion', 'armour/energy shield', 'evasion/energy shield'];
/** D-450 (proceed-on, §25): an evasion build, pure or hybrid, read from `n`'s `defence.base`. */
const evasionBase = (base) => typeof base === 'string' && base.split('/').includes('evasion');

/**
 * D-451 (§6, §22, Appendix A): in a build held to revision 12, a schema-8 plan's non-budget rung states its defence plan
 * beside `skills.engagement`, `stages[].defence {base, chance, mitigation, pool, physicalHit}`, `base` a family of the
 * bases' attributes and the others short texts; a schema-7 plan has none to state.
 */
function checkDefencePlan(plan, endgame, fail) {
  if (!(isInt(plan.schemaVersion) && plan.schemaVersion >= 8)) return;
  const n = endgame.find((s) => s.variant === 'non-budget');
  if (!n) return;
  const d = n.defence;
  const texts = ['chance', 'mitigation', 'pool', 'physicalHit'];
  if (!isObj(d)) fail('defence-plan', `plan.json's non-budget rung ${n.id} has no defence {base, chance, mitigation, pool, physicalHit}; in a run held to amendment 12 a schema-8 plan states its defence plan on n, as it states its engagement (D-451, §22)`);
  else if (!DEFENCE_BASES.includes(d.base) || !texts.every((k) => typeof d[k] === 'string' && d[k].trim() !== '')) fail('defence-plan', `plan.json's non-budget rung ${n.id} has defence ${show(d)}; base is one of ${DEFENCE_BASES.join(', ')}, and chance, mitigation, pool and physicalHit short texts (D-451, Appendix A)`);
}

/** D-447: a stage's boss rotation, its entries' record keys: `skills.boss.entries`, else the named source alone. */
function rotationOf(stage) {
  const entries = list(stage?.skills?.boss?.entries);
  if (entries.length > 0) return entries.map((e) => ({ key: `g${e.group}s${e.activeSkill}p${e.statSet ?? 1}`, turns: e.turns === true }));
  const m = isObj(stage?.skills?.main) ? stage.skills.main : { group: 1, activeSkill: 1, statSet: 1 };
  return [{ key: `g${m.group}s${m.activeSkill}p${m.statSet ?? 1}`, turns: false }];
}

/**
 * D-447 (§9b's checks): the boss estimate's ledger rules on each endgame rung of a build held to amendment 11. A
 * `boss_<stage>` formula reads the rung's boss rotation, at least one `<stage>.boss.g<g>s<s>p<p>` entry figure, and no
 * entry outside the rotation (nor another stage's); a rotation with an entry PoB's trigger test calls triggered (the
 * record's `measures.bossGroups`) or one that takes turns (`turns: true`) has its `boss_<stage>` estimate.
 */
function checkBossLedger(endgame, plan, record, fail) {
  const ledger = new Map(list(plan.ledger).filter((e) => typeof e.id === 'string').map((e) => [e.id, e]));
  for (const s of endgame) {
    const rotation = rotationOf(s);
    const keys = new Set(rotation.map((r) => r.key));
    const entry = ledger.get(`boss_${s.id}`);
    const groups = list(record?.stages?.[s.id]?.measures?.bossGroups);
    const triggered = groups.filter((g) => g.triggered === true).map((g) => `g${g.group}s${g.activeSkill}p${g.statSet}`);
    const turns = [...rotation.filter((r) => r.turns).map((r) => r.key), ...groups.filter((g) => g.turns === true).map((g) => `g${g.group}s${g.activeSkill}p${g.statSet}`)];
    if (!entry) {
      if (triggered.length > 0 || turns.length > 0) {
        fail('boss-estimate', `stage ${s.id}'s boss rotation has ${triggered.length > 0 ? `an entry PoB rates at its hand-cast speed (triggered: ${[...new Set(triggered)].join(', ')})` : `entries that take turns (${[...new Set(turns)].join(', ')})`}, but plan.json's ledger has no boss_${s.id}; D1-finish estimates the rung's boss damage by hand there, its formula on the rotation's figures (D-447)`);
      }
      continue;
    }
    const refs = [...String(entry.formula ?? '').matchAll(/(?<![A-Za-z0-9_.])([A-Za-z0-9_]+)\.boss\.([A-Za-z0-9_]+)(?:\.([A-Za-z_][A-Za-z0-9_]*))?/g)].map((m) => ({ stage: m[1], what: m[2], text: m[0] }));
    if (!refs.some((r) => /^g\d+s\d+p\d+$/.test(r.what))) {
      fail('boss-estimate', `plan.json's ledger entry boss_${s.id} has the formula ${show(entry.formula)}, which reads no boss rotation entry ${s.id}.boss.g<group>s<skill>p<statSet>; the estimate starts from the record's boss figures (C-33, D-447)`);
    }
    for (const r of refs) {
      const outside = r.stage !== s.id || (/^g\d+s\d+p\d+$/.test(r.what) && !keys.has(r.what));
      if (outside) fail('boss-estimate', `plan.json's ledger entry boss_${s.id} reads ${r.text}, which is outside stage ${s.id}'s boss rotation (${[...keys].join(', ')}); its formula reads only the rung's own rotation entries and ${s.id}.boss.measured (D-447)`);
    }
  }
}

/**
 * D-437, D-441, D-447, D-448 (Appendix A, the D1 gate's design field): each rung's `damage {map, boss}`, `cull`,
 * `trigger`, `boss {measured, estimate, corrections}` and `trades[]`, and on the non-budget rung `toughness {engagement,
 * reason, target, band}` and the boss's `floor` and `under`. The non-budget rung's plan states its engagement. While the
 * gate is fresh (no producer ran after it), the band is recomputed from the record's TotalEHP, the plan's engagement and
 * references/toughness-targets.json; the estimate is the ledger's `boss_<stage>` value (its current formula) and null
 * without one; the floor is references/boss-floor.json's and `under` the boss figure below it; and the rung's trades are
 * trades.json's. A rung under its band has a defence trade, one over it or under the floor a damage trade (`none found: …`
 * counts), and the damage trade's `bossAfter` is the boss figure × (1 + damageChange / 100), except in a build held to
 * amendment 12 (`a12`), where D1-finish measures it on the trade's temporary stage (D-456).
 */
function checkDesignField({ file, design, endgame, plan, record, ledgerNow, trades, fresh, fail, a12 = false, a13 = false }) {
  const bad = (rule, why) => fail(rule, `${file}: ${why}`);
  const n = endgame.find((s) => s.variant === 'non-budget');
  const engagement = n?.skills?.engagement;
  if (n && !(isObj(engagement) && ['close', 'distance'].includes(engagement.kind) && typeof engagement.reason === 'string' && engagement.reason.trim() !== '')) {
    fail('toughness', `plan.json's non-budget rung ${n.id} has no skills.engagement {kind: "close" | "distance", reason}; in a run held to amendment 11 D1-build states how close the build fights, which sets its toughness target (D-441, §19)`);
  }
  const t = targetsOf(fail, file);
  const floor = floorOf(fail, file);
  for (const r of list(design.rungs)) {
    const st = endgame.find((s) => s.id === r.stage);
    if (!st) continue;
    const at = `design.rungs's ${show(r.stage)}`;
    const rec = record?.stages?.[r.stage];
    const isN = st.variant === 'non-budget';
    if (!isObj(r.damage) || !isNum(r.damage.map) || !isNum(r.damage.boss)) bad('design-field', `${at} has damage ${show(r.damage)}; it is {map, boss}, the named source's figure against map monsters and against a Pinnacle boss (D-437, Appendix A)`);
    if (!(r.cull === null || (isObj(r.cull) && isNum(r.cull.map) && isNum(r.cull.boss)))) bad('design-field', `${at} has cull ${show(r.cull)}; null, or {map, boss} in percent (D-437, Appendix A)`);
    if (!(r.trigger === null || (isObj(r.trigger) && typeof r.trigger.by === 'string' && isNum(r.trigger.usesPerSecond)))) bad('design-field', `${at} has trigger ${show(r.trigger)}; null, or {by, usesPerSecond} (D-437, Appendix A)`);
    const b = r.boss;
    if (!isObj(b) || !isNum(b.measured) || !numOrNull(b.estimate) || !Array.isArray(b.corrections) || !b.corrections.every((c) => typeof c === 'string')) {
      bad('design-field', `${at} has boss ${show(b)}; it is {measured, estimate | null, corrections: [<short phrase>]} (D-447, Appendix A)`);
      continue;
    }
    if (!Array.isArray(r.trades)) bad('design-field', `${at} has trades ${show(r.trades)}; the rung's trades from trades.json, a list (D-439, Appendix A)`);
    const rungTrades = list(r.trades);
    // D-447: the boss figure the gate shows, the estimate when there is one.
    const figure = isNum(b.estimate) ? b.estimate : b.measured;
    if (fresh) {
      // D-437: the figures are the record's, the cull only with the plan's `skills.cull`, the trigger the record's.
      const m = rec?.measures ?? {};
      if (isObj(r.damage) && isObj(m.damage) && (!sameFigure(r.damage.map, m.damage.map) || !sameFigure(r.damage.boss, m.damage.boss))) bad('design-field', `${at}'s damage is ${show(r.damage)}, but the record's ${r.stage}.measures.damage is ${show(m.damage)} (D-437)`);
      const culls = typeof st.skills?.cull === 'string' && st.skills.cull.trim() !== '';
      if (culls !== (r.cull !== null && r.cull !== undefined)) bad('design-field', `${at}'s cull is ${show(r.cull)}, but the plan's ${r.stage} ${culls ? 'states its cull, skills.cull' : 'has no skills.cull'}; the cull is counted, and shown, only when the rotation culls (D-437)`);
      else if (culls && isObj(r.cull) && isObj(m.cull) && (!sameFigure(r.cull.map, m.cull.map) || !sameFigure(r.cull.boss, m.cull.boss))) bad('design-field', `${at}'s cull is ${show(r.cull)}, but the record's ${r.stage}.measures.cull is ${show(m.cull)} (D-437)`);
      if (isObj(m.trigger) !== isObj(r.trigger) || (isObj(m.trigger) && isObj(r.trigger) && (m.trigger.by !== r.trigger.by || !sameFigure(r.trigger.usesPerSecond, m.trigger.usesPerSecond)))) bad('design-field', `${at}'s trigger is ${show(r.trigger)}, but the record's ${r.stage}.measures.trigger is ${show(m.trigger ?? null)} (D-437)`);
      const id = `boss_${r.stage}`;
      const estimated = list(plan.ledger).some((e) => e.id === id);
      const value = ledgerNow[id]?.value;
      if (estimated && !sameFigure(b.estimate, value)) bad('boss-estimate', `${at}'s boss.estimate is ${show(b.estimate)}, but the ledger's ${id} evaluates to ${isNum(value) ? round2(value) : `nothing (${ledgerNow[id]?.error ?? 'no value'})`} over the record; the gate shows the ledger's estimate (D-447)`);
      if (!estimated && b.estimate !== null) bad('boss-estimate', `${at}'s boss.estimate is ${show(b.estimate)}, but plan.json's ledger has no ${id}; without the estimate the boss figure is PoB alone, measures.damage.boss, and estimate is null (D-447)`);
      const measured = rec?.measures?.damage?.boss;
      if (isNum(measured) && !sameFigure(b.measured, measured)) bad('boss-estimate', `${at}'s boss.measured is ${show(b.measured)}, but the record's ${r.stage}.measures.damage.boss is ${measured} (D-447)`);
      // D-439: the gate reads the rung's trades from trades.json.
      if (trades !== null && Array.isArray(r.trades)) {
        const want = trades.filter((x) => x.stage === r.stage).map((x) => canon(x)).sort();
        const got = rungTrades.map((x) => canon(x)).sort();
        if (show(want) !== show(got)) bad('trades', `${at}'s trades aren't trades.json's for ${r.stage}: the design field carries ${got.length} and trades.json ${want.length} (D-439)`);
      }
    }
    if (!isN) continue;
    // D-441: the toughness target, its engagement and its band.
    const tough = r.toughness;
    let band = null;
    if (!isObj(tough) || !['close', 'distance'].includes(tough.engagement) || !isNum(tough.target) || !['under', 'within', 'over'].includes(tough.band) || typeof tough.reason !== 'string') {
      bad('toughness', `${at} has toughness ${show(tough)}; on the non-budget rung it is {engagement: "close" | "distance", reason, target, band: "under" | "within" | "over"} (D-441, Appendix A)`);
    } else {
      band = tough.band;
      if (fresh && t !== null) {
        if (isObj(engagement) && tough.engagement !== engagement.kind) bad('toughness', `${at}'s toughness.engagement is ${show(tough.engagement)}, but the plan's ${r.stage}.skills.engagement is ${show(engagement.kind)} (D-441)`);
        const target = t.targets[isObj(engagement) && ['close', 'distance'].includes(engagement.kind) ? engagement.kind : tough.engagement];
        if (tough.target !== target) bad('toughness', `${at}'s toughness.target is ${show(tough.target)}, but references/toughness-targets.json gives a ${isObj(engagement) ? engagement.kind : tough.engagement} build ${target} (D-441)`);
        const ehp = rec?.outputs?.TotalEHP;
        if (!isNum(ehp)) bad('toughness', `${at}'s band can't be recomputed: the record has no ${r.stage}.TotalEHP (D-441)`);
        else {
          const want = bandOf(ehp, target, t);
          if (tough.band !== want) bad('toughness', `${at}'s toughness.band is ${show(tough.band)}, but the record's TotalEHP ${round2(ehp)} against the ${target} target is ${want} (under ${t.under * target}, over ${t.over * target}; D-441)`);
          band = want;
        }
      }
    }
    // D-448: the boss floor, and whether the rung is under it.
    let under = b.under === true;
    if (!isNum(b.floor) || typeof b.under !== 'boolean') bad('boss-floor', `${at}'s boss has floor ${show(b.floor)} and under ${show(b.under)}; on the non-budget rung the floor is references/boss-floor.json's and under true when the boss figure is below it (D-448, Appendix A)`);
    else if (floor !== null) {
      if (b.floor !== floor) bad('boss-floor', `${at}'s boss.floor is ${show(b.floor)}, but references/boss-floor.json's floor is ${floor} (D-448)`);
      const boss = fresh ? (list(plan.ledger).some((e) => e.id === `boss_${r.stage}`) ? ledgerNow[`boss_${r.stage}`]?.value : rec?.measures?.damage?.boss) : figure;
      if (isNum(boss)) {
        under = boss < floor;
        if (b.under !== under) bad('boss-floor', `${at}'s boss.under is ${b.under}, but the boss figure ${round2(boss)}${fresh && list(plan.ledger).some((e) => e.id === `boss_${r.stage}`) ? ` (the ledger's boss_${r.stage})` : ''} is ${under ? 'under' : 'at or above'} the ${floor} floor (D-448)`);
      }
    }
    // D-441, D-448: a rung out of its band, or under the floor, shows a trade, `none found: …` when there is none.
    const has = (kind) => rungTrades.some((x) => x.kind === kind);
    if (band === 'under' && !has('defence')) fail('trades', `${file}: the non-budget rung ${r.stage} is under its toughness band, but no defence trade is shown for it (a trades.json entry, kind defence; "none found: <why>" when there is none) (D-441)`);
    // D-468 (amendment 13): under the floor at the gate, D-448's damage trade, or D1-tree's boss trade, is shown.
    if (a13 && band !== 'over' && under && !has('damage') && !has('boss')) fail('trades', `${file}: the non-budget rung ${r.stage} is under the boss floor at the gate, but no damage or boss trade is shown for it (a trades.json entry, kind damage, "none found: <why>" when there is none, or D1-tree's boss trade) (D-448, D-468)`);
    else if ((band === 'over' || (under && !(a13 && has('boss')))) && !has('damage')) fail('trades', `${file}: the non-budget rung ${r.stage} is ${[band === 'over' ? 'over its toughness band' : null, under ? 'under the boss floor' : null].filter(Boolean).join(' and ')}, but no damage trade is shown for it (a trades.json entry, kind damage; "none found: <why>" when there is none) (D-441, D-448)`);
    // D-448: the damage trade's boss figure after it moves with the named source's; D-456 (amendment 12) measures it.
    for (const x of rungTrades.filter((y) => !a12 && y.kind === 'damage' && isNum(y.damageChange))) {
      const want = figure * (1 + x.damageChange / 100);
      if (!sameFigure(x.bossAfter, want)) fail('trades', `${file}: the non-budget rung ${r.stage}'s damage trade (${show(x.what)}) has bossAfter ${show(x.bossAfter)}; it is the boss figure ${round2(figure)} × (1 + ${x.damageChange} / 100) = ${round2(want)} (D-448, Appendix A)`);
    }
  }
}

/**
 * D-449 (Appendix A): the shape of a `b` or `n` rung's `maxHit {lowest, immune, arbiter, oneShot}` in a design field
 * written under amendment 12's rules; null when it is right, else what it should be.
 */
function maxHitProblem(mh) {
  const isText = (v) => typeof v === 'string' && v.trim() !== '';
  if (!isObj(mh)) return 'on b and n it is {lowest, immune, arbiter, oneShot}';
  if (!(mh.lowest === null || (isObj(mh.lowest) && isText(mh.lowest.type) && isNum(mh.lowest.value)))) return 'its lowest is null or {type, value}, the lowest of the five max hits';
  if (!Array.isArray(mh.immune) || !mh.immune.every(isText)) return 'its immune is a list of the types PoB makes the build immune to';
  const a = mh.arbiter;
  if (!(a === null || (isObj(a) && isText(a.type) && numOrNull(a.evade) && numOrNull(a.deflect) && isNum(a.hitsSurvived) && numOrNull(a.deflectedRatio) && [null, undefined, 'pass', 'formula'].includes(a.method)))) return 'its arbiter is null or the deciding row, {type, evade, deflect, hitsSurvived, deflectedRatio, method}';
  if (typeof mh.oneShot !== 'boolean') return 'its oneShot is true or false, by the floor';
  return null;
}

/**
 * Names, D-449: each row of a record's `measures.arbiter` (on `b` and `n`) survives no more of its hits than Names' rule
 * gives its full hit: 100% when the full hit survives; else the evade chance plus (1 − the evade chance) × the deflect
 * chance when the deflected hit survives; else the evade chance alone (a deflected hit that kills too counts only the evade
 * chance). Less is allowed, since a row keeps the least over its type's hits (an unevadable one among them).
 */
function checkArbiterRows(stage, arbiter, fail) {
  if (!hasHitsSurvived(arbiter)) return;
  const avoid = isObj(arbiter.avoid) ? arbiter.avoid : null;
  const e = isNum(avoid?.evade) ? avoid.evade : 0;
  const d = isNum(avoid?.deflect) ? avoid.deflect : 0;
  for (const row of list(arbiter.rows)) {
    // A row with no verdict has no hits survived (null); a one-shot row may have no ratio, its max hit of 0 (WU-120).
    if (!isNum(row.hitsSurvived) || !['survives', 'one-shot'].includes(row.verdict)) continue;
    const at = `compile-record.json's ${stage}.measures.arbiter row ${show(row.type)}`;
    const ratioWords = isNum(row.ratio) ? `ratio ${round2(row.ratio)}` : 'a max hit of 0';
    if (row.verdict === 'survives' || row.immune === true) {
      if (Math.abs(row.hitsSurvived - 100) > 0.5) fail('arbiter', `${at} survives its full hit (${ratioWords}), but its hitsSurvived is ${row.hitsSurvived}; a row that survives the full hit survives 100% of them (Names, D-449)`);
      continue;
    }
    const deflectedSurvives = d > 0 && isNum(row.deflectedRatio) && row.deflectedRatio < 1;
    const bound = deflectedSurvives ? e + ((100 - e) * d) / 100 : e;
    if (row.hitsSurvived > bound + 0.5) {
      const why = deflectedSurvives ? `the evade chance ${pct1(e)}% plus (1 − ${pct1(e)}%) × the deflect chance ${pct1(d)}%` : d > 0 && isNum(row.deflectedRatio) ? `its deflected hit kills too (${round2(row.deflectedRatio)} of the max hit), so only the evade chance counts` : 'only the evade chance counts';
      fail('arbiter', `${at} is one-shot by its full hit (${ratioWords}) and survives ${pct1(row.hitsSurvived)}% of its hits, more than Names' rule gives: ${why}, at most ${round2(bound)}% (Names, D-449)`);
    }
  }
}

/**
 * Amendment 12 (D-449, D-450, D-454; Appendix A, the D1 gate's design field), for a build whose last D1 gate is held to
 * revision 12: each variant rung's `damage.resisting`; each `b` and `n` rung's `maxHit {lowest, immune, arbiter,
 * oneShot}`, `arbiter` the deciding row and `oneShot` by the floor in references/toughness-targets.json; and on `n`,
 * `toughness`'s `chanceShare`, `conditioned {ehp, band}`, `ailmentCut` and `warning {kind, type, fix} | null`. While the
 * gate is fresh, each is recomputed from the record: the deciding row and the one-shot rung from `measures.arbiter`
 * (hits survived unrounded), the lowest max hit from `measures.toughness`, the chance-layer share from its `chance.share`,
 * the conditioned band from `conditioned.ehp`, the ailment cut from PoB's `DeflectChance` × `DeflectEffect`; the warning,
 * from the field's own values when it isn't fresh, is the one-shot warning when the EHP is within or over its band on a
 * one-shot rung, else the conditioned one when the conditioned EHP is under its band, else none (G5 as G4's first case).
 * The trades (D-450): a one-shot rung has a defence trade (`none found: …` counts), its defence and damage entries carry
 * `maxHit`, and its damage trade doesn't lower it; an evasion build (`n`'s `defence.base`) has an avoidance trade on `b`
 * and `n`. The record's rows hold to Names' rule (`checkArbiterRows`).
 */
function checkDesignField12({ file, design, endgame, plan, record, fresh, fail }) {
  const bad = (rule, why) => fail(rule, `${file}: ${why}`);
  const t = referenceJson('toughness-targets.json');
  const read = arbiterFloor();
  if (read === null) fail('arbiter', `${file}: references/toughness-targets.json gives no arbiter.hitsSurvivedFloor, the floor of hits survived a rung needs not to be one-shot (D-449, Appendix A)`);
  const floor = read ?? ARBITER_FLOOR;
  const floorWords = `${Math.round(floor * 100)}%`;
  const n = endgame.find((s) => s.variant === 'non-budget');
  const evasion = evasionBase(n?.defence?.base);
  const engagement = n?.skills?.engagement;
  const near = (x, y, tol) => isNum(x) && isNum(y) && Math.abs(x - y) <= tol;
  for (const r of list(design.rungs)) {
    const st = endgame.find((s) => s.id === r.stage);
    if (!st) continue;
    const at = `design.rungs's ${show(r.stage)}`;
    const rec = record?.stages?.[r.stage];
    const m = isObj(rec?.measures) ? rec.measures : {};
    // D-454: the resisting figure on every variant rung (null where the record's is: no resisting measure).
    if (!isObj(r.damage) || !('resisting' in r.damage) || !numOrNull(r.damage.resisting)) bad('design-field', `${at} has damage ${show(r.damage)}; a design field written under amendment 12's rules gives {map, resisting, boss}, resisting the figure against the map enemy with 40% fire, cold and lightning resistance (D-454, Appendix A)`);
    else if (fresh && isObj(m.damage) && 'resisting' in m.damage && (isNum(m.damage.resisting) ? !sameFigure(r.damage.resisting, m.damage.resisting) : r.damage.resisting !== null)) bad('design-field', `${at}'s damage.resisting is ${show(r.damage.resisting)}, but the record's ${r.stage}.measures.damage.resisting is ${show(m.damage.resisting)} (D-454)`);
    if (st.variant !== 'budget' && st.variant !== 'non-budget') continue;
    const rungWord = st.variant;
    checkArbiterRows(r.stage, m.arbiter, fail);
    // D-449: the deciding row and the one-shot rung.
    const mh = r.maxHit;
    let oneShot = null;
    let decidingType = null;
    const problem = maxHitProblem(mh);
    if (problem !== null) bad('design-field', `${at} has maxHit ${show(mh)}; ${problem} (D-449, Appendix A)`);
    else {
      oneShot = mh.oneShot;
      decidingType = isObj(mh.arbiter) ? mh.arbiter.type : null;
      if (fresh) {
        const tm = isObj(m.toughness) ? m.toughness : null;
        if (tm !== null) {
          const lowest = isObj(tm.lowestMaxHit) ? tm.lowestMaxHit : null;
          if ((lowest === null) !== (mh.lowest === null) || (lowest !== null && (mh.lowest.type !== lowest.type || !sameFigure(mh.lowest.value, lowest.value)))) bad('arbiter', `${at}'s maxHit.lowest is ${show(mh.lowest)}, but the record's ${r.stage}.measures.toughness.lowestMaxHit is ${show(lowest)} (D-449)`);
          const immune = Array.isArray(tm.immune) ? [...tm.immune].sort() : [];
          if (show([...mh.immune].sort()) !== show(immune)) bad('arbiter', `${at}'s maxHit.immune is ${show(mh.immune)}, but the record's ${r.stage}.measures.toughness.immune is ${show(tm.immune ?? [])} (D-449)`);
        }
        const reading = hasHitsSurvived(m.arbiter) ? arbiterReading(m.arbiter, floor) : null;
        if (reading !== null) {
          const row = reading.row;
          const avoid = isObj(m.arbiter.avoid) ? m.arbiter.avoid : null;
          // M-25's leftover (amendment 13 §15): a rung that isn't one-shot, with a row that has no verdict (PoB gave no max
          // hit for its type), isn't measured against the Arbiter, so its field can't read as surviving its hits.
          const unverdicted = list(m.arbiter.rows).filter((x) => !['survives', 'one-shot'].includes(x.verdict)).map((x) => show(x.type));
          if (!reading.measured && !reading.oneShot) {
            if (mh.arbiter !== null) bad('arbiter', `${at}'s maxHit.arbiter is the ${show(mh.arbiter?.type ?? null)} row, so the design field reads as surviving the Arbiter's hits, but the record's ${unverdicted.join(', ')} row${unverdicted.length === 1 ? ' has' : 's have'} no verdict (PoB gave no max hit for that type): the rung isn't measured against the Arbiter, and its maxHit.arbiter is null (D-449, D-459)`);
          } else if (row === null) {
            if (mh.arbiter !== null) bad('arbiter', `${at}'s maxHit.arbiter is ${show(mh.arbiter)}, but the record's ${r.stage}.measures.arbiter has no row with a ratio to decide (D-449)`);
          } else if (!isObj(mh.arbiter) || mh.arbiter.type !== row.type) {
            bad('arbiter', `${at}'s maxHit.arbiter is the ${show(mh.arbiter?.type ?? null)} row, but the record's deciding row is ${show(row.type)}: a rung's one-shot row with the lowest hits survived, else its row with the largest ratio (Names, D-449)`);
          } else {
            const a = mh.arbiter;
            if (!near(a.hitsSurvived, survivedOf(row), 0.05)) bad('arbiter', `${at}'s maxHit.arbiter.hitsSurvived is ${pct1(a.hitsSurvived)}, but the record's ${row.type} row survives ${pct1(survivedOf(row))}% of its hits (D-449)`);
            const dr = isNum(row.deflectedRatio) ? row.deflectedRatio : null;
            if (dr === null ? a.deflectedRatio !== null : !near(a.deflectedRatio, dr, 0.005)) bad('arbiter', `${at}'s maxHit.arbiter.deflectedRatio is ${show(a.deflectedRatio)}, but the record's ${row.type} row has ${show(dr)} (D-449)`);
            const [ev, de] = [isNum(avoid?.evade) ? avoid.evade : 0, isNum(avoid?.deflect) ? avoid.deflect : 0];
            if (!near(a.evade ?? 0, ev, 0.05) || !near(a.deflect ?? 0, de, 0.05)) bad('arbiter', `${at}'s maxHit.arbiter chances are evade ${show(a.evade)}, deflect ${show(a.deflect)}, but the record's ${r.stage}.measures.arbiter.avoid gives evade ${ev}, deflect ${de} at the Arbiter's accuracy (D-449)`);
            if ((a.method ?? null) !== (avoid?.method ?? null)) bad('arbiter', `${at}'s maxHit.arbiter.method is ${show(a.method ?? null)}, but the record's avoid.method is ${show(avoid?.method ?? null)} (D-449)`);
          }
          if (mh.oneShot !== reading.oneShot) {
            const how = row === null ? 'has no deciding row' : row.verdict === 'one-shot' ? `is one-shot by its full hit and survives ${pct1(survivedOf(row))}% of its hits, ${reading.oneShot ? 'under' : 'at or over'} the ${floorWords} floor` : 'survives its full hit';
            bad('arbiter', `${at}'s maxHit.oneShot is ${mh.oneShot}, but the record's deciding row ${row ? `(${row.type}) ` : ''}${how} (references/toughness-targets.json; D-449)`);
          }
          oneShot = reading.oneShot;
          decidingType = row?.type ?? null;
        }
      }
    }
    // D-450: the defence trade on a one-shot rung, the damage trade's max hit there, and an evasion build's avoidance trade.
    const rungTrades = list(r.trades);
    const has = (kind) => rungTrades.some((x) => x.kind === kind);
    if (oneShot === true && !has('defence')) fail('trades', `${file}: the ${rungWord} rung ${r.stage} is a one-shot rung (the Arbiter's ${decidingType === null ? 'deciding' : typeWords(decidingType)} hit, under the ${floorWords} floor), but no defence trade is shown for it (a trades.json entry, kind defence; "none found: <why>" when there is none) (D-450)`);
    if (oneShot === true) {
      for (const x of rungTrades.filter((y) => ['defence', 'damage'].includes(y.kind) && !NONE_FOUND.test(String(y.what ?? '')))) {
        const mx = x.maxHit;
        if (!isObj(mx) || !isNum(mx.before) || !isNum(mx.after)) fail('trades', `${file}: the one-shot rung ${r.stage}'s ${x.kind} trade (${show(x.what)}) carries no maxHit {type, before, after}, the deciding row's Pinnacle-pass max hit before and after it (D-450, Appendix A)`);
        else if (x.kind === 'damage' && mx.after < mx.before) fail('trades', `${file}: the one-shot rung ${r.stage}'s damage trade (${show(x.what)}) lowers the deciding row's max hit, ${mx.before} → ${mx.after}; a damage trade on a one-shot rung may not lower it (D-450)`);
      }
    }
    if (evasion && !has('avoidance')) fail('trades', `${file}: the ${rungWord} rung ${r.stage} of an evasion build (the non-budget rung's defence base ${show(n.defence.base)}) shows no avoidance trade, the next avoidance spend and the best gear line (a trades.json entry, kind avoidance; "none found: <why>" when there is none) (D-450)`);
    if (st.variant !== 'non-budget') continue;
    // D-449: the non-budget rung's toughness reading. Its shape, then the record's figures while fresh, then the warning.
    const tough = r.toughness;
    if (!isObj(tough)) continue;
    // The record's chance layers or conditioned read may be missing (no number from PoB): the field's are null then.
    const c = tough.conditioned;
    const cOk = isObj(c) && isNum(c.ehp) && ['under', 'within', 'over'].includes(c.band);
    const w = tough.warning;
    const wOk = w === null || (isObj(w) && ['one-shot', 'conditioned'].includes(w.kind) && typeof w.type === 'string' && w.type !== '' && typeof w.fix === 'string');
    const shape = [
      numOrNull(tough.chanceShare) ? null : 'chanceShare (percent) or null',
      cOk || c === null ? null : 'conditioned {ehp, band: "under" | "within" | "over"} or null',
      tough.ailmentCut === null || isNum(tough.ailmentCut) ? null : 'ailmentCut (percent) or null',
      wOk ? null : 'warning {kind: "one-shot" | "conditioned", type, fix} or null',
    ].filter(Boolean);
    if (shape.length > 0) bad('design-field', `${at}'s toughness is ${show(tough)}; under amendment 12 it gains ${shape.join(', ')} (D-449, Appendix A)`);
    const target = isNum(tough.target) ? tough.target : t?.targets?.[engagement?.kind];
    let band = tough.band;
    let condBand = cOk ? c.band : null;
    let condType = null;
    if (fresh && isObj(t) && isNum(t.under) && isNum(t.over) && isNum(target)) {
      const tm = isObj(m.toughness) ? m.toughness : null;
      if (isNum(rec?.outputs?.TotalEHP)) band = bandOf(rec.outputs.TotalEHP, target, t);
      const share = tm?.chance?.share;
      if (isNum(share) ? !near(tough.chanceShare, share * 100, 0.5) : tm !== null && tough.chanceShare !== null && tough.chanceShare !== undefined) bad('toughness', `${at}'s toughness.chanceShare is ${show(tough.chanceShare ?? null)}, but the record's ${r.stage}.measures.toughness.chance${isNum(share) ? `.share is ${share}, ${round2(share * 100)}%` : ' is null, so it is null'} (D-449)`);
      if (tm !== null && !(isObj(tm.conditioned) && isNum(tm.conditioned.ehp)) && c !== null && c !== undefined) bad('toughness', `${at}'s toughness.conditioned is ${show(c)}, but the record's ${r.stage}.measures.toughness has no conditioned EHP, so it is null (D-449)`);
      if (isObj(tm?.conditioned) && isNum(tm.conditioned.ehp)) {
        if (c === null) bad('toughness', `${at}'s toughness.conditioned is null, but the record's ${r.stage}.measures.toughness.conditioned.ehp is ${tm.conditioned.ehp} (D-449)`);
        condBand = bandOf(tm.conditioned.ehp, target, t);
        condType = isObj(tm.conditioned.lowestMaxHit) ? tm.conditioned.lowestMaxHit.type : null;
        if (cOk && !sameFigure(c.ehp, tm.conditioned.ehp)) bad('toughness', `${at}'s toughness.conditioned.ehp is ${c.ehp}, but the record's ${r.stage}.measures.toughness.conditioned.ehp is ${tm.conditioned.ehp} (D-449)`);
        if (cOk && c.band !== condBand) bad('toughness', `${at}'s toughness.conditioned.band is ${show(c.band)}, but the conditioned EHP ${round2(tm.conditioned.ehp)} against the ${target} target is ${condBand} (D-441, D-449)`);
      }
      const [dc, de] = [rec?.outputs?.DeflectChance, rec?.outputs?.DeflectEffect];
      const cut = isNum(dc) && dc > 0 && isNum(de) ? (dc * de) / 100 : null;
      if (cut === null ? tough.ailmentCut !== null && tough.ailmentCut !== undefined : !near(tough.ailmentCut, cut, 0.5)) bad('toughness', `${at}'s toughness.ailmentCut is ${show(tough.ailmentCut ?? null)}, but ${cut === null ? 'the build deflects nothing against the map enemy (no DeflectChance), so it is null' : `PoB's DeflectChance ${dc} × DeflectEffect ${de} / 100 is ${round2(cut)}`} (PG-97, D-449)`);
    }
    // G4, with G5 as its first case: the one-shot warning, else the conditioned one, else none.
    const want = (band === 'within' || band === 'over') && oneShot === true ? { kind: 'one-shot', type: decidingType } : condBand === 'under' ? { kind: 'conditioned', type: condType } : null;
    if (!wOk) continue;
    if (want === null) {
      if (w !== null) bad('toughness', `${at}'s toughness.warning is ${show(w)}, but no warning applies: the EHP is ${band ?? 'unknown'} its band${oneShot === true ? '' : ' and the rung is not one-shot'}, and the conditioned EHP is ${condBand ?? 'unknown'} its band (D-449)`);
    } else if (w === null) {
      bad('toughness', `${at}'s toughness.warning is null, but ${want.kind === 'one-shot' ? `the EHP reads ${band} its band while the Arbiter's ${typeWords(want.type ?? 'deciding')} hit one-shots the rung` : 'with every condition against it the EHP falls under its band'}: the warning is {kind: "${want.kind}", type${want.type ? ` "${want.type}"` : ''}, fix} (D-449)`);
    } else if (w.kind !== want.kind) {
      bad('toughness', `${at}'s toughness.warning is the ${w.kind} warning, but the ${want.kind} warning applies (G5, the one-shot rung within or over its band, before the conditioned EHP under it; D-449)`);
    } else if (want.type !== null && w.type !== want.type) {
      bad('toughness', `${at}'s ${w.kind} warning names the ${show(w.type)} hit, but ${want.kind === 'one-shot' ? "the deciding row's type" : "the conditioned lowest max hit's type"} is ${show(want.type)} (D-449)`);
    } else if (w.fix !== fixFamily(w.type)) {
      bad('toughness', `${at}'s ${w.kind} warning's fix is ${show(w.fix)}; for a ${typeWords(w.type)} hit the fix family is "${fixFamily(w.type)}" (D-449)`);
    }
  }
}

/**
 * Amendment 13 (D-467, D-468, D-473; Appendix A, the D1 gate's design field), for a build whose last D1 gate is held to
 * revision 13: each rung's `life {start, end}`, `swapCap {swaps, lastGain} | null`, `rebuild` ("taken", "none" or
 * "undone: <why>"), `removedForOthers [{names, skill}]` and `levels [{skill, plus}]`, and its boss's `start`, `end`,
 * `entries [{label, start, end, final, valuedBy {figure, reason} | null}]` and `bossFall {claim, reason} | null`. While
 * the gate is fresh, each is the plan's `tree.start`, `tree.end` and `tree.search` (D1-tree's), and each entry's final
 * figure the record's boss figure of its group; a `bossFall`'s claim is `boss-fall-<rung>`, which the plan's rung holds.
 * The target: a rung whose boss figure, or an entry, fell from start to end says why (`bossFall`); a boss figure that
 * fell shows a boss trade; and on `n` D1-tree's own change never takes the boss figure under the floor
 * (references/boss-floor.json) from a start at or above it.
 */
function checkDesignField13({ file, design, endgame, plan, record, fresh, fail }) {
  const bad = (rule, why) => fail(rule, `${file}: ${why}`);
  const text = (v) => typeof v === 'string' && v.trim() !== '';
  const floor = referenceJson('boss-floor.json')?.floor;
  for (const r of list(design.rungs)) {
    const st = endgame.find((s) => s.id === r.stage);
    if (!st) continue;
    const at = `design.rungs's ${show(r.stage)}`;
    const rec = record?.stages?.[r.stage];
    const tree = isObj(st.tree) ? st.tree : {};
    const [start, end, search] = [tree.start, tree.end, tree.search].map((x) => (isObj(x) ? x : null));
    // The shapes (Appendix A).
    const life = r.life;
    if (!(isObj(life) && isNum(life.start) && isNum(life.end))) bad('design-field', `${at} has life ${show(life)}; it is {start, end}, Life at D1-tree's start and on its finished tree (D-467, Appendix A)`);
    if (!(r.swapCap === null || (isObj(r.swapCap) && isInt(r.swapCap.swaps) && numOrNull(r.swapCap.lastGain)))) bad('design-field', `${at} has swapCap ${show(r.swapCap)}; null, or {swaps, lastGain} when the swap loop hit its cap of 30 (D-467, Appendix A)`);
    if (!(typeof r.rebuild === 'string' && /^(?:taken|none|undone: \S[\s\S]*)$/.test(r.rebuild))) bad('design-field', `${at} has rebuild ${show(r.rebuild)}; "taken", "none" or "undone: <why>" (D-467, Appendix A)`);
    const namesOk = (v) => text(v) || (Array.isArray(v) && v.length > 0 && v.every(text));
    if (!(Array.isArray(r.removedForOthers) && r.removedForOthers.every((x) => isObj(x) && namesOk(x.names) && text(x.skill)))) bad('design-field', `${at} has removedForOthers ${show(r.removedForOthers)}; a list of {names, skill}, the passives the rebuild removed whose lines name another skill the build uses (D-467, Appendix A)`);
    if (!(Array.isArray(r.levels) && r.levels.every((x) => isObj(x) && text(x.skill) && isInt(x.plus)))) bad('design-field', `${at} has levels ${show(r.levels)}; a list of {skill, plus}, the damage skills pieces.md's "## Skill levels" leaves at +0 (D-473, Appendix A)`);
    const b = isObj(r.boss) ? r.boss : {};
    const entries = list(b.entries);
    const entryOk = (e) => text(e.label) && numOrNull(e.start) && numOrNull(e.end) && numOrNull(e.final) && (e.valuedBy === null || (isObj(e.valuedBy) && isNum(e.valuedBy.figure) && text(e.valuedBy.reason)));
    if (!numOrNull(b.start) || !numOrNull(b.end) || !Array.isArray(b.entries) || entries.length !== b.entries.length || !entries.every(entryOk)) {
      bad('design-field', `${at}'s boss has start ${show(b.start)}, end ${show(b.end)} and entries ${show(b.entries)}; start and end are the boss figure at D1-tree's start and end, and entries [{label, start, end, final, valuedBy: {figure, reason} | null}] (D-468, Appendix A)`);
    }
    const fall = b.bossFall;
    if (!(fall === null || (isObj(fall) && fall.claim === `boss-fall-${r.stage}` && text(fall.reason)))) bad('design-field', `${at}'s boss.bossFall is ${show(fall)}; null, or {claim: "boss-fall-${r.stage}", reason}, the designer's reason for a fall (D-468, Appendix A)`);
    else if (isObj(fall) && !list(st.claims).some((cl) => cl.id === fall.claim)) bad('boss-fall', `${at}'s boss.bossFall names the claim ${fall.claim}, but plan.json's ${r.stage} holds no claim of that id; D1-finish turns the designer's reason into it, which V4 checks (D-468)`);
    // While fresh: the plan's tree.start, tree.end and tree.search, which D1-tree wrote and D1-gate step 6 copies.
    if (fresh) {
      if (start === null || end === null || search === null) bad('design-field', `plan.json's ${r.stage} has ${['start', 'end', 'search'].filter((k, i) => [start, end, search][i] === null).map((k) => `no tree.${k}`).join(', ')}; D1-tree writes each rung's start, end and search, and the gate copies them into the design field (D-467, Appendix A)`);
      else {
        const same = (x, y) => (x === null || x === undefined ? y === null || y === undefined : sameFigure(x, y));
        const differ = [];
        if (isObj(life) && (!same(life.start, start.life) || !same(life.end, end.life))) differ.push(`life ${show(life)} against Life ${show(start.life)} → ${show(end.life)}`);
        if (!same(b.start, start.boss) || !same(b.end, end.boss)) differ.push(`boss ${show(b.start)} → ${show(b.end)} against ${show(start.boss)} → ${show(end.boss)}`);
        const startEntries = list(start.bossEntries);
        const endEntries = list(end.bossEntries);
        const labels = startEntries.map((e) => e.label);
        if (show([...entries.map((e) => e.label)].sort()) !== show([...labels].sort())) differ.push(`entries ${show(entries.map((e) => e.label))} against ${show(labels)}`);
        for (const e of entries) {
          const s0 = startEntries.find((x) => x.label === e.label);
          const e0 = endEntries.find((x) => x.label === e.label);
          if (s0 && !same(e.start, s0.figure)) differ.push(`${e.label}'s start ${show(e.start)} against ${show(s0.figure)}`);
          if (e0 && !same(e.end, e0.figure)) differ.push(`${e.label}'s end ${show(e.end)} against ${show(e0.figure)}`);
          // The gate's final figure: the record's boss figure of the entry's group.
          const group = s0?.group ?? e0?.group;
          const figure = list(rec?.measures?.bossGroups).find((g) => g.group === group)?.figure;
          if (isNum(figure) && !same(e.final, figure)) differ.push(`${e.label}'s final ${show(e.final)} against the record's ${r.stage}.measures.bossGroups figure ${round2(figure)}`);
        }
        const cap = search.capHit === true ? { swaps: search.swaps, lastGain: search.lastGain ?? null } : null;
        if (canon(r.swapCap ?? null) !== canon(cap)) differ.push(`swapCap ${show(r.swapCap)} against tree.search's ${show(cap)} (capHit ${show(search.capHit)})`);
        if (r.rebuild !== search.rebuild) differ.push(`rebuild ${show(r.rebuild)} against ${show(search.rebuild)}`);
        if (canon(list(r.removedForOthers)) !== canon(list(search.removed))) differ.push(`removedForOthers ${show(r.removedForOthers)} against tree.search.removed ${show(search.removed)}`);
        const reason = isObj(fall) ? fall.reason : null;
        if ((reason ?? null) !== (search.bossFall ?? null)) differ.push(`bossFall's reason ${show(reason)} against tree.search.bossFall ${show(search.bossFall ?? null)}`);
        if (differ.length > 0) bad('design-field', `${at} disagrees with plan.json's ${r.stage} tree.start, tree.end and tree.search, or the record: ${differ.join('; ')} (D-467, D-468, Appendix A)`);
      }
    }
    // The target (D-468): a fall says why, a boss figure that fell shows the alternative tree, and on n D1-tree's own
    // change keeps the agreed floor.
    const fellBoss = isNum(b.start) && isNum(b.end) && b.end < b.start;
    const fellEntries = entries.filter((e) => isNum(e.start) && isNum(e.end) && e.end < e.start).map((e) => e.label);
    if ((fellBoss || fellEntries.length > 0) && fall === null) {
      fail('boss-fall', `${file}: on ${r.stage} ${[fellBoss ? `the boss figure fell from ${whole(b.start)} to ${whole(b.end)} on the tree` : null, fellEntries.length > 0 ? `${fellEntries.join(', ')} fell` : null].filter(Boolean).join(', and ')}, but bossFall is null; the designer says why a fall is fine, one reason that may cover several entries (D-468)`);
    }
    if (fellBoss && !list(r.trades).some((x) => x.kind === 'boss')) fail('trades', `${file}: on ${r.stage} the boss figure fell from ${whole(b.start)} to ${whole(b.end)} on the tree, but no boss trade is shown for it (a trades.json entry, kind boss: the best tree D1-tree measured at or above the start's boss figure) (D-468)`);
    if (st.variant === 'non-budget' && isNum(floor) && isNum(b.start) && isNum(b.end) && b.end < floor && b.start >= floor) {
      fail('boss-floor', `${file}: on ${r.stage} D1-tree's tree takes the boss figure from ${whole(b.start)} to ${whole(b.end)}, under the ${whole(floor)} floor; a change of D1-tree's own that takes n's boss figure under the floor is undone (D-468)`);
    }
  }
}

/** A figure with thousands separators, as the checker's boss messages print it. */
const whole = (v) => (isNum(v) ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : show(v));

/**
 * D-465 (amendment 13): a plan's item texts hold no rune line (`Rune: <name>`) of a rune over the budget, a "Legacy of …"
 * soul core or the Raven-Touched Shard, unless the user asked for it (`says`: the brief's `around`, `like` and `notes`,
 * and the gate answers' words).
 */
function checkOverBudgetPlan(planStages, says, fail) {
  for (const s of planStages) {
    for (const it of [...list(s.items?.slots).map((x) => ({ where: `slot "${x.slot}"`, text: x.text })), ...list(s.items?.treeJewels).map((x) => ({ where: `tree jewel in node ${x.node}`, text: x.text }))]) {
      for (const line of String(it.text ?? '').split(/\r?\n/)) {
        const m = /^\s*Rune:\s*(.+?)\s*$/i.exec(line);
        const kind = m ? overBudgetRune(m[1]) : null;
        if (kind === null || askedFor(m[1], says)) continue;
        fail('runes', `plan.json's stage ${s.id} ${it.where} holds the rune line ${show(line.trim())}, ${kind === 'legacy' ? 'a "Legacy of …" soul core' : 'the Raven-Touched Shard'}, a rune over the budget, but neither the brief's around, like or notes nor a gate answer names it; design leaves every rune over the budget out unless the user asks for it (D-465)`);
      }
    }
  }
}

/** The skill's corruption rule (Appendix A): `references/corruption.json`, `{cheapUnique: {under, currency}, rungs, source}`. */
function corruptionRule(fail) {
  const c = referenceJson('corruption.json');
  if (!isObj(c) || !isObj(c.cheapUnique) || !isNum(c.cheapUnique.under) || c.cheapUnique.currency !== 'divine' || !Array.isArray(c.rungs) || !c.rungs.every((x) => RUNGS.includes(x))) {
    fail('corruption', "references/corruption.json can't be read as {cheapUnique: {under, currency: \"divine\"}, rungs: [<rung variant>], source} (D-471, Appendix A)");
    return null;
  }
  return c;
}

/**
 * D-471 (amendment 13): corruption only on a cheap unique (a unique jewel among them) and a skill gem corrupted to +1
 * level. A rare, magic or normal item with a `Corrupted` line fails. A unique with a designed corruption, an `{enchant}`
 * line beside its `Corrupted` line (the amulet's `Allocates` anoint aside), is on a rung `references/corruption.json`
 * names (`b` and `n`), priced uncorrupted under its cheap line (1 divine, at the gate's recorded rates); with no price to
 * judge by (`unavailable`, or a currency with no rate), its price entry's note says `cheapness unchecked: <why>` (in an
 * offline run, the note "offline run" says it). A unique that comes corrupted (its `Corrupted` line with no enchant, as
 * Split Personality drops) is the item as it drops: no rule. The guide (when one is current) says each: "Buy several
 * <unique> and corrupt them until one rolls <line>", and for each `corrupt` gem "Corrupt cheap low-level <gem> gems until
 * one gets +1 level, then level it to 20".
 */
function checkCorruption({ plan, planStages, gate, guide, offline, fail }) {
  const rule = corruptionRule(fail);
  const entries = new Map(list(plan?.prices).map((p) => [p.id, p]));
  const lines = typeof guide === 'string' ? guide.split(/\r?\n/).map(plainName) : null;
  const says = (...words) => lines !== null && lines.some((l) => words.every((w) => (w instanceof RegExp ? w.test(l) : l.includes(plainName(w)))));
  const budget = isObj(gate?.basis?.budget) ? gate.basis.budget : {};
  const prices = new Map(list(budget.slots).map((x) => [`${x.stage}|${x.jewel !== undefined ? `jewel ${x.jewel}` : x.slot}`, x.priceId]));
  const rates = ratesOf(budget);
  for (const s of planStages) {
    const items = [...list(s.items?.slots).map((x) => ({ where: `slot "${x.slot}"`, key: x.slot, text: x.text })), ...list(s.items?.treeJewels).map((x) => ({ where: `tree jewel in node ${x.node}`, key: `jewel ${x.node}`, text: x.text }))];
    const rung = typeof s.variant === 'string' ? s.variant : 'campaign';
    for (const it of items) {
      const item = itemOf(it.text);
      if (!item.corrupted) continue;
      const at = `plan.json's stage ${s.id} ${it.where}`;
      if (item.rarity !== 'UNIQUE') {
        fail('corruption', `${at} holds a corrupted ${String(item.rarity ?? 'unknown').toLowerCase()} item; corruption is only on cheap uniques and skill gems, never on a rare, magic or normal item, jewels among them: a corrupted rare cuts the trade supply by an order of magnitude or more (D-471)`);
        continue;
      }
      if (item.enchants.length === 0) continue; // the unique as it drops, corrupted (Split Personality)
      if (rule === null) continue;
      if (!rule.rungs.includes(rung)) {
        fail('corruption', `${at} holds ${item.name ?? 'a unique'} with a designed corruption (${item.enchants.join('; ')}) on a ${rung === 'campaign' ? 'campaign stage' : `${rung} rung`}; a designed corruption is on ${rule.rungs.join(' and ')} only (D-471, references/corruption.json)`);
        continue;
      }
      const id = prices.get(`${s.id}|${it.key}`);
      const entry = id === undefined ? undefined : entries.get(id);
      if (entry === undefined) {
        fail('corruption', `${at} holds ${item.name ?? 'a unique'} with a designed corruption, but the D1 gate maps it to no price entry, so its cheapness can't be judged; it is priced uncorrupted, under ${rule.cheapUnique.under} divine (D-471)`);
      } else {
        const d = divinesOf(entry, rates);
        if (d !== null) {
          if (d >= rule.cheapUnique.under) fail('corruption', `${at} holds ${item.name ?? 'a unique'} with a designed corruption, priced ${round2(d)} divine(s) uncorrupted (${entry.id}), at or over the cheap line of ${rule.cheapUnique.under} divine: a unique that dear can't carry a corrupted line (D-471, references/corruption.json)`);
        } else if (!(offline && entry.note === OFFLINE_NOTE) && !/\bcheapness unchecked: \S/i.test(String(entry.note ?? ''))) {
          fail('corruption', `${at} holds ${item.name ?? 'a unique'} with a designed corruption, but its price entry ${entry.id} is ${entry.status === 'ok' ? 'in a currency with no rate' : show(entry.status)} with the note ${show(entry.note ?? null)}; with no price to judge by, the note says "cheapness unchecked: <why>" (D-471)`);
        }
      }
      if (lines !== null && item.name && !says(item.name, /\bbuy several\b/, /\bcorrupt/)) fail('corruption', `guide.md has no line for ${item.name}'s corruption on ${s.id}: "Buy several ${item.name} and corrupt them until one rolls <line>" (D-471)`);
    }
    for (const g of list(s.skills?.groups)) {
      for (const gem of list(g.gems)) {
        if (gem.corrupt === undefined || gem.corrupt === null) continue;
        if (lines !== null && !says(String(gem.name ?? ''), /\bcorrupt/, /\+1 level\b/)) fail('corruption', `guide.md has no line for ${gem.name}'s corruption on ${s.id}: "Corrupt cheap low-level ${gem.name} gems until one gets +1 level, then level it to 20" (D-471)`);
      }
    }
  }
}

/**
 * D-472 (amendment 13): the flasks and charms of a build held to revision 13: every endgame rung holds a life flask in
 * `Flask 1` (its base a Life Flask); no stage fills a charm slot, which stay empty until amendment 14's survey. The flasks
 * are unpriced (`recomputeBudget`); the mana flask is D1-build's judgment, with its claim.
 */
function checkFlasks(planStages, fail) {
  for (const s of planStages) {
    for (const x of list(s.items?.slots).filter((y) => /^Charm \d+$/.test(String(y.slot ?? '')))) {
      fail('flasks', `plan.json's stage ${s.id} fills ${show(x.slot)}; the charm slots stay empty for now, charms waiting on amendment 14's survey (D-472)`);
    }
    if (typeof s.variant !== 'string') continue;
    const flask = list(s.items?.slots).find((y) => y.slot === 'Flask 1');
    if (!flask || !/\bLife Flask\b/i.test(String(flask.text ?? ''))) fail('flasks', `plan.json's endgame rung ${s.id} has ${flask ? `${show(itemOf(flask.text).lines.slice(1, 3).join(' / '))} in Flask 1` : 'no Flask 1'}; every endgame rung carries a life flask in Flask 1, the best base its level allows (D-472)`);
  }
}

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
 * Survival floor (D-118, D-119, D-234, D-254, D-256, D-353), from the plan and the record alone: all four
 * resistances capped (chaos only by the exception); the five waystone-scaled reference hits the compiler wrote
 * into the stage's config (`configWritten`, filling any the plan omits), each D-254's formula at the rung's area
 * level, rounded by D-256; max hits above the hits.
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
    // D-353: the five waystone-scaled reference hits, read from the record as the compiler wrote them. Each is
    // D-254's formula at the rung's area level: the monster damage there × (1 + the top of the increased-damage
    // modifier / 100), and × the top of the extra-damage-as-element modifier / 100 for an element or chaos, rounded
    // to 2 decimals and then up to a whole number (D-256: PoB's enemy<Type>Damage options take whole numbers).
    const written = isObj(record.stages[s.id]?.configWritten) ? record.stages[s.id].configWritten : {};
    const level = areaLevelOf(s.variant);
    const base = isNum(level) ? factValue('enemies/map-monsters.json', 'damage.by-level')?.[String(level)] : undefined;
    const increased = factValue('enemies/waystones.json', 'mods.increased-monster-damage')?.max;
    const extra = factValue('enemies/waystones.json', 'mods.extra-damage-as-element')?.max;
    const hits = [];
    for (const type of HIT_TYPES) {
      const t = type.toLowerCase();
      const value = written[`enemy${type}Damage`];
      if (!isNum(value) || value <= 0) {
        failures.push(failure('floor', s.id, `reference-hit-missing-${t}`, `stage ${s.id}'s record has no waystone-scaled ${type} reference hit (configWritten.enemy${type}Damage); the compiler writes each one the plan omits (D-119, D-254, D-353)`));
        continue;
      }
      hits.push({ type, value });
      if (isNum(base) && isNum(increased) && isNum(extra)) {
        const expected = base * (1 + increased / 100) * (type === 'Physical' ? 1 : extra / 100);
        if (value !== hitCeiling(expected)) {
          failures.push(failure('floor', s.id, `reference-hit-ledger-${t}`, `stage ${s.id}'s recorded enemy${type}Damage ${value} isn't ${hitCeiling(expected)}: the damage at its area level ${level} (enemies/map-monsters.json#damage.by-level[${level}], ${base}) × (1 + ${increased} / 100)${type === 'Physical' ? '' : ` × ${extra} / 100`} is ${round2(expected)}, rounded to 2 decimals and then up (D-254, D-256, D-353)`));
        }
      }
    }
    for (const { type, value } of hits) {
      const code = `max-hit-${type.toLowerCase()}`;
      const max = out[`${type}MaximumHitTaken`];
      if (!isNum(max)) failures.push(failure('floor', s.id, code, `stage ${s.id} has no ${type}MaximumHitTaken in the record`));
      else if (!(max > value)) failures.push(failure('floor', s.id, code, `stage ${s.id} ${type}MaximumHitTaken ${max} isn't above the enemy${type}Damage hit ${value}`));
    }
  }
  return { verdict: failures.length > 0 ? 'fail' : 'pass', failures };
}

/**
 * Budget (D-164, D-249, D-358, D-370, D-371, D-373) for every endgame rung, `m`, `b` and `n`, from the plan's
 * prices, the gate's map from filled slots, tree jewels and the anoint to price entries (`basis.budget.slots`), its
 * recorded rates and `data/economy/prices.json`, by gates.md's "Price days, targets and ranges". Every filled slot
 * and tree jewel has an entry (D-249); a total counts only the entries the slots name, so a fallback
 * (`<id>-fallback`), which no slot names, counts in none. The part is `unverified` when any rung's total isn't known
 * (D-164), else `pass`: it never fails (D-371). With `file` (the gate is fresh), the gate's `market`, each rung's
 * total and its `over-target` findings are held to the recompute within the stated margins.
 */
function recomputeBudget(endgame, plan, rep, file, fail, a13 = false) {
  const b = isObj(rep.basis?.budget) ? rep.basis.budget : {};
  const maps = list(b.slots);
  const prices = new Map(list(plan.prices).map((p) => [p.id, p]));
  let unverified = false;
  for (const s of endgame) {
    // D-464 (amendment 13): a pinned weapon's Swap slot (`sameAs`) is the set-1 slot's item, priced by that slot's entry,
    // once for both; the gate maps it to that entry, or not at all.
    const pinned = pinnedSlots(s);
    for (const [slot, set1] of pinned) {
      const own = maps.find((x) => x.stage === s.id && x.slot === slot);
      const theirs = maps.find((x) => x.stage === s.id && x.slot === set1);
      if (own && theirs && own.priceId !== theirs.priceId) fail('budget', `${s.variant} stage ${s.id}'s slot "${slot}" holds the item of "${set1}" (sameAs), but the gate maps it to ${show(own.priceId)}, not "${set1}"'s ${show(theirs.priceId)}; a pinned weapon is one item, priced once by its set-1 slot's entry (D-464)`);
    }
    // D-358: the anoint is priced like a slot, `{stage, slot: "Anoint", priceId}` in the gate's basis (D1-gate.md). D-472
    // (amendment 13): a build held to revision 13 prices no flask.
    const filled = [
      ...list(s.items?.slots).filter((it) => !pinned.has(it.slot) && !(a13 && FLASK_SLOT.test(String(it.slot ?? '')))).map((it) => ({ what: `slot "${it.slot}"`, slot: it.slot, text: it.text })),
      ...list(s.items?.treeJewels).map((j) => ({ what: `tree jewel in node ${j.node}`, jewel: j.node, text: j.text })),
      ...(isObj(s.items?.anoint) ? [{ what: `anoint (${s.items.anoint.notable})`, slot: 'Anoint', text: `anoint ${s.items.anoint.notable}` }] : []),
    ];
    const used = new Map();
    for (const it of filled) {
      const map = maps.find((x) => x.stage === s.id && (it.slot !== undefined ? x.slot === it.slot : x.jewel === it.jewel));
      const price = map ? prices.get(map.priceId) : undefined;
      if (!price) {
        fail('budget', `${s.variant} stage ${s.id}'s filled ${it.what} maps to no prices[] entry${map ? ` (the gate names ${show(map.priceId)})` : ''}; every filled slot and tree jewel is priced (§5.3, D-249)`);
        unverified = true;
        continue;
      }
      if (used.has(map.priceId) && used.get(map.priceId).text !== it.text) {
        fail('budget', `${s.variant} stage ${s.id}'s ${it.what} and ${used.get(map.priceId).what} share price entry ${show(map.priceId)} but hold different items; each has its own entry unless the item text is identical`);
      }
      if (!used.has(map.priceId)) used.set(map.priceId, it);
    }
  }
  for (const x of maps) {
    if (String(x.priceId).endsWith('-fallback')) fail('budget', `the D1 gate's basis.budget.slots maps stage ${x.stage}'s ${x.jewel !== undefined ? `tree jewel in node ${x.jewel}` : `slot ${show(x.slot)}`} to the fallback ${show(x.priceId)}; a fallback is in no slot and counts in no total (D-371, gates.md)`);
  }
  let table;
  try {
    table = priceTable();
  } catch (e) {
    fail('budget', `${e.message}; the budget's ranges can't be recomputed (D-373)`);
    return { verdict: 'unverified', failures: [], unverified: true };
  }
  const market = marketOf(plan, b, table);
  const rungs = endgame.map((s) => ({ s, got: rungBudget(s, plan, b, market, table, { flasksUnpriced: a13 }) }));
  if (rungs.some((r) => r.got.total === null)) unverified = true;
  if (file) holdBudgetToRecompute(plan, rep, b, maps, market, rungs, file, fail);
  return { verdict: unverified ? 'unverified' : 'pass', failures: [], unverified };
}

/**
 * gates.md: the D1 gate adds by hand, so its `basis.budget.market` must equal the recompute; each recorded `low` and
 * `high`, a total's or an `over-target` finding's, be within one rounding step of the checker's; and its
 * `over-target` findings be the checker's, except where the checker's midpoint is within the target's margin.
 */
function holdBudgetToRecompute(plan, rep, b, maps, market, rungs, file, fail) {
  const targets = new Map(list(plan.prices).map((p) => [p.id, p.query?.target?.divines]));
  const range = (low, high) => `${roundDivines(low)}–${roundDivines(high)}`;
  const near = (said, mine) => isNum(said) && Math.abs(said - roundDivines(mine)) <= roundingStep(mine) + 1e-9;
  const m = b.market;
  if (!isObj(m) || m.league !== market.league || m.day !== market.day || m.late !== market.late) {
    fail('budget', `${file}'s basis.budget.market is ${show(m)}, but the plan's league and prices and data/economy/prices.json give ${show(market)} (gates.md step 1, D-373)`);
  }
  for (const { s, got } of rungs) {
    const row = list(b.totals).find((t) => t.stage === s.id);
    if (!row) {
      fail('budget', `${file}'s basis.budget.totals has no entry for stage ${s.id}; one per endgame rung, {stage, low, high, day} (gates.md)`);
      continue;
    }
    if (row.day !== got.day) fail('budget', `${file}'s basis.budget.totals gives stage ${s.id} day ${show(row.day)}; its price day is ${got.day} (D-370)`);
    if (got.total === null) {
      if (row.low !== null || row.high !== null) fail('budget', `${file}'s basis.budget.totals gives stage ${s.id} ${show(row.low)}–${show(row.high)}, but a price of that rung is unavailable or has no rate, so its total isn't known: low and high are null (D-164)`);
      continue;
    }
    for (const end of ['low', 'high']) {
      if (!near(row[end], got.total[end])) fail('budget', `${file}'s basis.budget.totals gives stage ${s.id} ${end} ${show(row[end])}, but the recompute from the plan's prices and data/economy/prices.json is ${roundDivines(got.total[end])} (about ${range(got.total.low, got.total.high)} divines around day ${got.day}), more than one rounding step from it (gates.md)`);
    }
  }
  // Over-target findings, keyed by stage and price entry (`total` for m's).
  const priceIdOf = (stageId, f) => maps.find((x) => x.stage === stageId && (f.jewel !== undefined ? x.jewel === f.jewel : x.slot === f.slot))?.priceId;
  const keyOf = (stageId, f) => (f.slot === undefined && f.jewel === undefined ? `${stageId}|total` : `${stageId}|${priceIdOf(stageId, f) ?? '?'}`);
  const where = (f) => `stage ${f.stage}'s ${f.jewel !== undefined ? `tree jewel in node ${f.jewel}` : f.slot !== undefined ? `slot ${show(f.slot)}` : 'total'}`;
  const mine = new Map(rungs.flatMap(({ s, got }) => got.overTarget.map((o) => [keyOf(s.id, o), o])));
  const said = list(rep.findings).filter((f) => f.part === 'budget' && f.code === 'over-target');
  const saidKeys = new Set(said.map((f) => keyOf(f.stage, f)));
  for (const [key, o] of mine) {
    if (saidKeys.has(key) || o.mid - o.target <= targetMargin(o.target) + 1e-9) continue;
    fail('budget', `${file} has no over-target finding for ${where(o)}: its range is about ${range(o.low, o.high)} divines around day ${PRICE_DAY[rungs.find((r) => r.s.id === o.stage).s.variant]}, its midpoint ${round2(o.mid)} above its ${o.target}-divine target (gates.md step 7, D-371)`);
  }
  for (const f of said) {
    const rung = rungs.find((r) => r.s.id === f.stage);
    if (!rung) {
      fail('budget', `${file}'s over-target finding names stage ${show(f.stage)}, which isn't an endgame rung`);
      continue;
    }
    const o = mine.get(keyOf(f.stage, f));
    if (o) {
      if (!near(f.low, o.low) || !near(f.high, o.high)) fail('budget', `${file}'s over-target finding for ${where(f)} gives ${show(f.low)}–${show(f.high)}, but the recompute is about ${range(o.low, o.high)}, more than one rounding step from it (gates.md)`);
      if (f.target !== o.target) fail('budget', `${file}'s over-target finding for ${where(f)} gives target ${show(f.target)}; it is ${o.target} divines (D-370)`);
      continue;
    }
    // Not over by the recompute: allowed only where the midpoint is within the target's margin.
    const s = rung.s;
    const priceId = f.slot === undefined && f.jewel === undefined ? null : priceIdOf(s.id, f);
    let [mid, t] = [undefined, undefined];
    if (s.variant === 'entering-maps') {
      if (priceId === null) [mid, t] = [rung.got.total?.mid, M_TARGET];
    } else if (priceId) {
      [mid, t] = [rung.got.ranges.get(priceId)?.mid, targets.get(priceId)];
    }
    if (isNum(mid) && isNum(t) && t - mid <= targetMargin(t) + 1e-9) continue;
    fail('budget', `${file} has an over-target finding for ${where(f)}, but the recompute ${isNum(mid) && isNum(t) ? `puts its midpoint at ${round2(mid)}, not above its ${t}-divine target` : s.variant === 'entering-maps' ? "finds no such over-target item: on m, only the rung's total is measured against its 5-divine target" : 'finds no priced rare with a target there'} (gates.md step 7)`);
  }
}

/**
 * The named damage source's gate, the part `rolledSkill` (D-122 and D-148 as D-295 words them, D-217; amendment
 * 1 S7): its group (`rolledGroup`) has role clear or single_target, its figure is the largest of that role, read
 * from the record for every group the gate compares, × each group's Count where the record has a counted copy
 * (`countedSkillOutputs`, D-294, D-340), and a `skillOutputs` figure of its group is of the stage's
 * `skills.main.statSet`, the set the PoB file opens on. A group whose damage is its minion's, one the record resolved
 * a minion skill for (D-378) or whose compared skill summons a minion (D-385, `summonsMinion`), is compared by its
 * minion's figure, `Minion<Field>` at the same key, where the others compare `<Field>`.
 */
function recomputeRolledSkill(endgame, plan, record, rep, ledgerNow, fail) {
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
    const minions = minionGroups(record.stages?.[s.id]);
    const fields = new Set();
    const named = new Set();
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
        // D-378, D-385: a group whose damage is its minion's (it names a minion skill, or its compared skill
        // summons a minion) is compared by its minion's figure, so one field means `<Field>` for the others and
        // `Minion<Field>` for it.
        const names = minions.has(n);
        const minion = names || summonsMinion(record.stages?.[s.id], `g${sk[1]}s${sk[2]}p${sk[3]}`);
        if (minion && !/^Minion[A-Z]/.test(sk[4])) {
          const why = names ? 'the group names a minion skill' : "the group's skill summons a minion";
          fail('rolled-skill', `the D1 gate's figure ${show(f.figure)} for stage ${s.id}'s group ${n} is the player's ${sk[4]}, but ${why}, so its figure is its minion's Minion${sk[4]} at the same key (D-378, ${names ? '' : 'D-385, '}gates.md)`);
        }
        fields.add(minion ? sk[4].replace(/^Minion(?=[A-Z])/, '') : sk[4]);
        named.add(sk[4]);
        // D-340: × the group's Count where the record has a counted copy of the field, else the raw per-copy value.
        const read = figureOf(record.stages[s.id], f.figure);
        value = read.value;
        if (read.counted) counted.add(n);
        // S7: the named source's figure is the main skill's, of the stat set the PoB file opens on.
        if (n === rolled && isInt(main.statSet, 1) && `g${sk[1]}s${sk[2]}p${sk[3]}` !== mainKey) {
          failures.push(failure('rolledSkill', s.id, 'rolled-stat-set', `stage ${s.id}'s named damage source's figure ${f.figure} isn't the main skill's stat set ${mainKey} (skills.main); the PoB file opens on that set, so the gate compares its figure (S7)`));
        }
      } else if (lg) {
        value = ledgerNow[lg[1]]?.value;
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
    if (fields.size > 1) fail('rolled-skill', `the D1 gate compares stage ${s.id}'s groups by different fields ${show([...named])}; it uses one field for every group, its minion's Minion<Field> for a group whose damage is its minion's (gates.md, D-378, D-385)`);
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
// The round copy and what changed since it (A-34, D-352)
// ---------------------------------------------------------------------------------------------------

/** A-34: what `--snapshot <n>` copies into `rounds/<n>/`, and all that a round folder holds. */
export const ROUND_FILES = ['plan.json', 'compile-record.json', 'guide.md'];
/** D-477 (amendment 13): the round copy of a build with no guide.md (a file-only build's claims pass): the plan and the record. */
export const ROUND_FILES_NO_GUIDE = ['plan.json', 'compile-record.json'];
const ROUND_N = /^[1-9]\d*$/;
/** `--snapshot <n>`'s working folder `rounds/.<n>.tmp-XXXXXX`, renamed to `rounds/<n>/` once whole; the layout skips it. */
const ROUND_TMP = /^\.[1-9]\d*\.tmp-\w{6}$/;

/**
 * A-34: copies the plan, the record and the guide into `rounds/<n>/`, `<n>` the number of the V4 report the round
 * answers. It never overwrites a round, and copies nothing unless all three files exist. The copy is made in a
 * working folder inside `rounds/` and renamed to `<n>` once whole, so a copy failing midway leaves no round and can
 * be made again. Returns null, or why not. D-477 (amendment 13): a build with no guide.md (a file-only build's claims
 * pass) copies its plan and its record.
 */
export function snapshotRound(runFolder, n, folder = '.') {
  const base = path.join(runFolder, folder);
  const rounds = path.join(base, 'rounds');
  const dir = path.join(rounds, String(n));
  if (fs.existsSync(rounds) && !fs.statSync(rounds).isDirectory()) return 'rounds is a file; the round copies go in the folder rounds/ (A-34)';
  if (fs.existsSync(dir)) return `rounds/${n}/ exists; a round copy is never overwritten (A-34)`;
  const files = fs.existsSync(path.join(base, 'guide.md')) ? ROUND_FILES : ROUND_FILES_NO_GUIDE;
  const missing = files.filter((f) => !fs.existsSync(path.join(base, f)));
  if (missing.length > 0) return `the run folder has no ${missing.join(', ')}; the round copy holds ${ROUND_FILES.join(', ')}, or ${ROUND_FILES_NO_GUIDE.join(' and ')} for a build with no guide (A-34, D-477)`;
  let tmp = null;
  try {
    fs.mkdirSync(rounds, { recursive: true });
    tmp = fs.mkdtempSync(path.join(rounds, `.${n}.tmp-`));
    for (const f of files) fs.copyFileSync(path.join(base, f), path.join(tmp, f), fs.constants.COPYFILE_EXCL);
    fs.renameSync(tmp, dir);
    tmp = null;
    return null;
  } catch (e) {
    return `the round copy rounds/${n}/ wasn't made (${e.code ?? e.message}); nothing was copied, so it can be made again (A-34)`;
  } finally {
    if (tmp !== null) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** JSON with sorted keys, so two values compare by content. */
const canon = (v) => JSON.stringify(v, (_, x) => (isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x)) ?? 'null';

/**
 * The record values a claim's source cites (D-352), on one side of the comparison:
 * - `ledger:<id>`: the entry (its claim, formula and inputs) and its value, the plan's current formula evaluated
 *   over the record with the server's evaluator (D-365), so a ledger-only edit and a recompile both count;
 * - `price:<id>`: the plan's price entry;
 * - a `pob-computed` tag: the record field its ref names, `<stage>.<Field>` (`outputs`, and the main group's
 *   counted copy) or `<stage>.g<g>s<s>p<p>.<Field>` (`skillOutputs`, and its counted copy, D-340); a minion's
 *   figure is such a field, `MinionTotalDPS` with its counted copy (D-376, D-378);
 * - anything else (`data:<file>#<key>`, the other tag kinds): nothing beyond the source itself.
 */
function citedValues(side, source) {
  if (typeof source === 'string') {
    const m = /^(ledger|price):(\S+)$/.exec(source);
    if (m?.[1] === 'ledger') return { entry: list(side.plan?.ledger).find((e) => e.id === m[2]) ?? null, value: side.ledger[m[2]] ?? null };
    if (m?.[1] === 'price') return { price: list(side.plan?.prices).find((p) => p.id === m[2]) ?? null };
    return null;
  }
  if (!isObj(source) || source.kind !== 'pob-computed' || typeof source.ref !== 'string') return null;
  const [stageId, ...rest] = source.ref.split('.');
  const rec = isObj(side.record?.stages) && Object.prototype.hasOwnProperty.call(side.record.stages, stageId) ? side.record.stages[stageId] : null;
  if (!isObj(rec)) return { missing: source.ref };
  if (rest.length === 1) return { raw: rec.outputs?.[rest[0]] ?? null, counted: rec.countedOutputs?.fields?.[rest[0]] ?? null };
  return { raw: rec.skillOutputs?.[rest[0]]?.fields?.[rest[1]] ?? null, counted: rec.countedSkillOutputs?.[rest[0]]?.fields?.[rest[1]] ?? null };
}

/**
 * Each ledger entry's result, `{value, error}`: the plan's current formula over the record's stages, by the server's
 * evaluator (D-365); `value` null when it errs.
 */
function ledgerResults(ledgerModule, plan, record) {
  if (!isObj(plan) || !Array.isArray(plan.ledger)) return {};
  const stages = isObj(record?.stages) ? record.stages : {};
  // D-447: each stage's boss rotation (`measures.bossGroups`) and PoB alone (`measures.damage.boss`) join its numbers,
  // `bossGroups` and `damageBoss`, so a `<stageId>.boss.…` reference evaluates (C-33), as the compiler's context does.
  const numbers = Object.fromEntries(Object.entries(stages).filter(([, s]) => isObj(s)).map(([id, s]) => [id, ledgerStage(s)]));
  const entries = plan.ledger.filter((e) => isObj(e) && typeof e.id === 'string' && typeof e.formula === 'string').map((e) => ({ id: e.id, formula: e.formula, inputs: list(e.inputs) }));
  const results = ledgerModule.evaluateLedger(entries, { stageIds: list(plan.stages).map((s) => s.id), stages: numbers });
  return Object.fromEntries(entries.map((e) => [e.id, { value: isNum(results[e.id]?.value) ? results[e.id].value : null, error: results[e.id]?.error?.message ?? null }]));
}

/** Each ledger entry's value: the plan's current formula over the record's stages (D-365), null when it errs. */
function ledgerValues(ledgerModule, plan, record) {
  return Object.fromEntries(Object.entries(ledgerResults(ledgerModule, plan, record)).map(([id, r]) => [id, r.value]));
}

/**
 * Each H2 of a guide with its body (to the next H1 or H2), keyed by title and occurrence. Without `knownIssues`, the
 * lines of the H3 `Known issues` (the runner's step-14 list, D-265) are left out of its H2's body.
 */
function h2Bodies(text, { knownIssues = true } = {}) {
  const md = parseMarkdown(text ?? '');
  const seen = new Map();
  return md.h2.map((h) => {
    const at = (seen.get(h.title) ?? 0) + 1;
    seen.set(h.title, at);
    const { start, end } = md.sectionOf(h);
    const ki = knownIssues ? null : md.headings.find((x) => x.level === 3 && x.title === KNOWN_ISSUES && x.line > start && x.line < end);
    const skip = ki ? md.sectionOf(ki) : { start: -1, end: -1 };
    const body = md.lines.slice(start + 1, end).filter((_, k) => !(start + 1 + k > skip.start && start + 1 + k < skip.end)).join('\n');
    return { title: h.title, key: `${h.title}\u0000${at}`, body: body.replace(/\s+$/, '') };
  });
}

/**
 * D-352: what changed between two copies of the run's plan, record and guide (`thenDir`, `nowDir`), as the lines
 * `--changed` prints, in plan order then guide order: `claim stages[<i>].claims[<k>] (<id>)` for each claim whose
 * text, source or cited record values changed (a claim is matched by its stage id and claim id; a new one counts as
 * changed), and `section <H2 title>` for each guide H2 whose body changed or is new. `knownIssues: false` leaves
 * the guide's Known issues list out of the comparison.
 */
function changedBetween(ledgerModule, thenDir, nowDir, options = {}) {
  const read = (base, f) => (fs.existsSync(path.join(base, f)) ? fs.readFileSync(path.join(base, f), 'utf8') : null);
  const parse = (base, f) => {
    try {
      return JSON.parse(read(base, f) ?? 'null');
    } catch {
      return null;
    }
  };
  const side = (base) => {
    const plan = parse(base, 'plan.json');
    const record = parse(base, 'compile-record.json');
    return { plan, record, guide: read(base, 'guide.md'), ledger: ledgerValues(ledgerModule, plan, record) };
  };
  const now = side(nowDir);
  const then = side(thenDir);
  const claimsOf = (plan) => {
    const out = [];
    const seen = new Map();
    list(plan?.stages).forEach((s, i) => list(s.claims).forEach((c, k) => {
      const base = `${s.id}\u0000${c.id}`;
      const at = (seen.get(base) ?? 0) + 1;
      seen.set(base, at);
      out.push({ i, k, claim: c, key: `${base}\u0000${at}` });
    }));
    return out;
  };
  const before = new Map(claimsOf(then.plan).map((c) => [c.key, c.claim]));
  const lines = [];
  for (const { i, k, claim, key } of claimsOf(now.plan)) {
    const old = before.get(key);
    const same = old !== undefined && old.text === claim.text && canon(old.source) === canon(claim.source)
      && canon(citedValues(then, old.source)) === canon(citedValues(now, claim.source));
    if (!same) lines.push(`claim stages[${i}].claims[${k}] (${claim.id})`);
  }
  // D-477 (amendment 13): a round copy with no guide (a file-only build's claims pass) is compared by its claims alone.
  if (then.guide === null) return lines;
  const sections = new Map(h2Bodies(then.guide, options).map((h) => [h.key, h.body]));
  for (const h of h2Bodies(now.guide, options)) if (sections.get(h.key) !== h.body) lines.push(`section ${h.title}`);
  return lines;
}

/**
 * D-352: what changed since the round copy `rounds/<n>/`, as the lines `--changed <n>` prints (`changedBetween`,
 * the round copy against the run folder). Returns `{lines}`, or `{error}`.
 */
export async function changedSince(runFolder, n, folder = '.') {
  const base = path.join(runFolder, folder);
  const dir = path.join(base, 'rounds', String(n));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return { error: `rounds/${n}/ doesn't exist; make the round copy first (--snapshot ${n}, A-34)` };
  const ledgerModule = await loadLedgerModule();
  if (ledgerModule === null) return { error: `the server's ledger evaluator ${path.relative(REPO, ledgerModulePath())} is missing; build the server (pnpm build)` };
  try {
    if (!isObj(JSON.parse(fs.readFileSync(path.join(base, 'plan.json'), 'utf8')))) throw new Error('not an object');
  } catch {
    return { error: "plan.json is missing or isn't JSON" };
  }
  return { lines: changedBetween(ledgerModule, dir, base) };
}

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

/**
 * D-412: the folder a `--snapshot` or `--changed` works in: a schema-4 run's build folder, named by `--build <card id>`
 * (`builds/<id>`, or "." for a migrated run's build); the root for a schema-2 or schema-3 run. `{folder}` or `{error}`.
 */
function buildFolderFor(runFolder, id) {
  let log = null;
  try {
    log = JSON.parse(fs.readFileSync(path.join(runFolder, 'run-log.json'), 'utf8'));
  } catch {
    log = null;
  }
  const v4 = isObj(log) && log.schemaVersion === 4;
  if (id === undefined) return v4 ? { error: 'a schema-4 run keeps each build in its folder: name the build with --build <card id> (D-412)' } : { folder: '.' };
  if (!v4) return { error: '--build is schema 4\'s (amendment 9); this run log isn\'t a schema-4 log' };
  const b = list(log.builds).find((x) => x.id === id);
  if (!b || typeof b.folder !== 'string') return { error: `run-log.json has no build ${id}; builds[] holds ${list(log.builds).map((x) => x.id).join(', ') || 'none'} (D-412)` };
  return { folder: b.folder };
}

async function main(argv) {
  const args = argv.slice(2);
  const usage = () => {
    process.stderr.write('usage: node check-run.mjs <runFolder> [--snapshot <n> | --changed <n>] [--build <card id>]\n');
    return 2;
  };
  if (args.length === 0 || args[0].startsWith('--')) return usage();
  // D-412: in a schema-4 run the round copy and its comparison are a build's, in its folder: --build <card id>.
  const withBuild = args.length === 5 && args[3] === '--build';
  if ((args.length === 3 || withBuild) && ['--snapshot', '--changed'].includes(args[1]) && ROUND_N.test(args[2])) {
    const folder = path.resolve(args[0]);
    const n = Number(args[2]);
    const where = buildFolderFor(folder, withBuild ? args[4] : undefined);
    if (where.error !== undefined) {
      process.stderr.write(`check-run: ${where.error}\n`);
      return 1;
    }
    const prefix = where.folder === '.' ? '' : `${where.folder}/`;
    if (args[1] === '--snapshot') {
      const why = snapshotRound(folder, n, where.folder);
      if (why !== null) {
        process.stderr.write(`check-run: ${why}\n`);
        return 1;
      }
      const copied = fs.readdirSync(path.join(folder, where.folder, 'rounds', String(n))).filter((f) => ROUND_FILES.includes(f));
      process.stdout.write(`check-run: copied ${ROUND_FILES.filter((f) => copied.includes(f)).map((f) => `${prefix}${f}`).join(', ')} to ${prefix}rounds/${n}/\n`);
      return 0;
    }
    const { lines, error } = await changedSince(folder, n, where.folder);
    if (error !== undefined) {
      process.stderr.write(`check-run: ${error}\n`);
      return 1;
    }
    for (const line of lines) process.stdout.write(`${line}\n`);
    return 0;
  }
  if (args.length !== 1) return usage();
  const folder = path.resolve(args[0]);
  const violations = await checkRun(folder);
  // D-435: the warnings, on stderr whether or not a violation was found.
  for (const w of violations.warnings ?? []) process.stderr.write(`check-run: warning: ${w}\n`);
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
