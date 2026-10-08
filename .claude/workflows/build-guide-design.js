export const meta = {
  name: 'build-guide-design',
  description: 'The design-and-write half of a build-guide run, for one chosen concept: D1 designs and prices both endgame variants and a fresh D1 gate checks them; D2 plans the campaign backward from the endgame and a fresh D2 gate checks every stage, then the final compile runs; W1 writes the guide; V3 and the three V4 lenses check it',
  whenToUse: 'Only from the build-guide skill (.claude/skills/build-guide/SKILL.md) or its fallback, once per chosen concept and again to resume after an escalation, with args {runFolder, runFolderRel, conceptId, mode, buildName, faults?, resume?, accepted?}',
  phases: [
    { title: 'D1 endgame', detail: 'build-guide-coordinator: D1 writes and prices both endgame variants, then a fresh D1 gate re-prices, compiles measure-only and checks the compile, V1, V2, the survival floor, the budget and the rolled skill; up to 2 retries each' },
    { title: 'D2 campaign', detail: 'build-guide-coordinator: D2 plans the campaign stages backward from D1, then a fresh D2 gate compiles the whole plan measure-only and, once that passes, runs the final compile; up to 2 retries each' },
    { title: 'W1 guide', detail: 'build-guide-writer writes guide.md from the plan, the final record, the dossier and the guide template; up to 2 retries' },
    { title: 'V3 and V4', detail: 'one build-guide-provenance agent and three build-guide-verifier lenses (ledger, sources, prose), at most 3 in flight' },
  ],
}

// The design-and-write workflow of the build-guide pipeline: docs/build-guide/spec/03-pipeline.md section 5.3.
// A saved workflow is plain JavaScript run by the Workflow tool: no filesystem, no clock, no randomness
// (docs/design/grounding/2026-10-07-claude-code-platform.md section 5).
//
// Args: {runFolder, runFolderRel, conceptId, mode, buildName, faults?, resume?, accepted?}
// - buildName is the run folder's last two segments joined with "-" (section 2): the final compile's file.
// - faults: the accepted test config's directives; this workflow applies FI-2 and FI-3 (both the D1 gate's).
// - resume (D-236): {reason: "guided-retry", stage, findings, guidance} or {reason: "accepted", stage,
//   findings}, from the escalation question; {reason: "revision", round, requests} from checkpoint 2 (the
//   revision resume arrives with WU-46). A resume may carry `attempts`, the attempts each stage of this
//   concept already made ({"D1": 3, "D1-gate": 3}), so attempt numbers, and with them the gate files,
//   continue; without it the escalated stage and its gate count as having used their cap.
// - accepted: findings the user accepted at earlier escalations of this concept, as the run log records them
//   (each with its gate), so a later gate keeps them accepted.
//
// Returns {status, stage?, evidence?, accepted?, gateVerdicts, v3Reports, v4Reports, stats}:
// - status: "ready", "infeasible" (D1 can't meet the floor, the budget or the rolled-skill gate, D-141) or
//   "escalated" (the retries ran out, D-127); stage names the step that ended the flow;
// - evidence: the findings behind an "infeasible" or "escalated", each with its gate and attempt;
// - accepted: every finding accepted for this concept, when there is one;
// - gateVerdicts: one D1 or D2 gate verdict per gate attempt that returned (references/gates.md);
// - v3Reports, v4Reports: the V3 and V4 reports, as returned (references/source-markers.md);
// - stats: {attempts, agents, retries, priceCalls, faults, revision} (references/run-log.md).

const STAGE_REFS = '.claude/skills/build-guide/references/stages/'
const TEMPLATE = '.claude/skills/build-guide/templates/guide-template.md'
const COORDINATOR = 'build-guide-coordinator'
const WRITER = 'build-guide-writer'
const PROVENANCE = 'build-guide-provenance'
const VERIFIER = 'build-guide-verifier'
const RETRIES = 2 // D-127: at most 2 retries per (stage, concept)
const FAN_OUT = 3 // D-161: at most 3 agents in flight
const LENSES = ['ledger', 'sources', 'prose']
const PRICING_STOPS = ['locked_out', 'rate_limited'] // section 9: pricing stops for the rest of the run
const FAULT_IDS = ['FI-2', 'FI-3'] // section 11.3: both are the D1 gate's
const VERDICTS = ['pass', 'fail', 'unverified']
const GATE_PARTS = {
  'D1-gate': ['compiled', 'v1', 'v2', 'floor', 'budget', 'rolledSkill'],
  'D2-gate': ['compiled', 'v1', 'v2'],
}
// A failure of one of these parts re-runs the producer and escalates once the retries run out; a failure of
// only the others (floor, budget, rolledSkill) ends "infeasible" (section 5.3's table).
const HARD_PARTS = ['compiled', 'v1', 'v2']
const GATE_OF = { D1: 'D1-gate', D2: 'D2-gate' }
const PRODUCER_OF = { 'D1-gate': 'D1', 'D2-gate': 'D2' }
const RESUME_STAGES = ['D1', 'D1-gate', 'D2', 'D2-gate', 'W1', 'V3', 'V4']

// ---- Arguments ---------------------------------------------------------------------------------------

const isText = (v) => typeof v === 'string' && v.trim() !== ''
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const input = isObj(args) ? args : {}
const need = (ok, what) => {
  if (!ok) throw new Error(`build-guide-design: ${what}`)
}
need(isText(input.runFolder), 'args.runFolder (the run folder\'s absolute path, from guide_run {new_run}) is required')
need(isText(input.runFolderRel), 'args.runFolderRel (the run folder relative to the guides root) is required')
need(isText(input.conceptId) && /^c[1-9]\d*$/.test(input.conceptId), 'args.conceptId is the chosen concept\'s id, c<n>')
need(input.mode === 'offline' || input.mode === 'online', 'args.mode is "offline" or "online"')
need(isText(input.buildName), 'args.buildName (the final compile\'s build_name) is required')
const runFolderRel = input.runFolderRel.replace(/\/+$/, '')
need(
  input.buildName === runFolderRel.split('/').slice(-2).join('-'),
  `args.buildName is the run folder's last two segments joined with "-" ("${runFolderRel.split('/').slice(-2).join('-')}"), so every run writes a new PoB file (section 2)`,
)

const { runFolder, conceptId, mode, buildName } = input

const resume = isObj(input.resume) ? input.resume : null
if (resume) {
  need(['guided-retry', 'accepted', 'revision'].includes(resume.reason), 'args.resume.reason is "guided-retry", "accepted" or "revision"')
  // The checkpoint-2 revision (section 5.3) maps requests to owners with a revise-map step, which arrives with
  // WU-46 together with the V3/V4 routing it shares.
  need(resume.reason !== 'revision', 'args.resume {reason: "revision"} (the checkpoint-2 revision) arrives with WU-46; it isn\'t wired yet')
  need(RESUME_STAGES.includes(resume.stage), `args.resume.stage is one of ${RESUME_STAGES.join(', ')}`)
  need(Array.isArray(resume.findings), 'args.resume.findings is the escalation\'s findings')
  if (resume.reason === 'guided-retry') need(isText(resume.guidance), 'args.resume.guidance (the user\'s guidance) is required for a guided retry')
}

// Fault directives (section 11.3) come only from an accepted test config, so only in offline mode. This
// workflow applies FI-2 and FI-3, both in the D1 gate's headers, and only for the concept they target.
const givenFaults = Array.isArray(input.faults) ? input.faults : []
if (mode !== 'offline' && givenFaults.length > 0) log('fault directives ignored: they apply only in offline test mode (section 11.2)')
const FAULTS = (mode === 'offline' ? givenFaults : [])
  .filter((d) => isObj(d) && FAULT_IDS.includes(d.id))
  .map((d) => ({
    id: d.id,
    concepts: d.concepts === 'all' ? 'all' : Array.isArray(d.concepts) ? d.concepts.filter(isText) : [],
    persistent: d.persistent === true,
  }))
  .filter((d) => d.concepts === 'all' || d.concepts.includes(conceptId))
const faultTally = FAULTS.map(() => ({ targeted: 0, applied: 0, observed: null }))
const faultsFor = (gateAttempt) => FAULTS.filter((d) => d.persistent || gateAttempt === 1)

// Accepted findings (section 5.4): equal by plan stage, part and code for a gate finding, by id and report for
// a V3/V4 finding. They fail no gate from the one the user accepted them at onwards.
const gateFor = (stage) => GATE_OF[stage] || stage
const withGate = (list, gate) =>
  (Array.isArray(list) ? list : []).filter(isObj).map((f) => ({ ...f, gate: isText(f.gate) ? f.gate : gate }))
const ACCEPTED = [
  ...withGate(input.accepted, null),
  ...(resume && resume.reason === 'accepted' ? withGate(resume.findings, gateFor(resume.stage)) : []),
]
const coveredGate = (f) =>
  ACCEPTED.some((a) => isText(a.code) && a.code === f.code && a.part === f.part && (isText(a.stage) ? a.stage : null) === (isText(f.stage) ? f.stage : null))
const coveredReport = (f, report) => ACCEPTED.some((a) => isText(a.id) && a.id === f.id && a.gate === report)

// Attempt numbers continue across a resume, so a resumed gate never reuses an earlier attempt's file.
const made = {}
if (resume && isObj(resume.attempts)) {
  for (const [k, v] of Object.entries(resume.attempts)) if (Number.isInteger(v) && v >= 0) made[k] = v
}
if (resume) {
  const gate = gateFor(resume.stage)
  for (const s of [gate, PRODUCER_OF[gate]].filter(Boolean)) if (made[s] === undefined) made[s] = 1 + RETRIES
}
const attempts = { ...made }
const nextAttempt = (stage) => {
  attempts[stage] = (attempts[stage] || 0) + 1
  return attempts[stage]
}

// ---- The task header (section 5.1) and the agent runner -----------------------------------------------

function header(h) {
  const out = { stage: h.stage, attempt: h.attempt, concept: conceptId }
  if (h.lens !== undefined) out.lens = h.lens
  if (h.pass !== undefined) out.pass = h.pass
  out.mode = mode
  out.runFolder = runFolder
  out.runFolderRel = runFolderRel
  out.compile = h.compile
  if (h.compile === 'final') out.buildName = buildName
  out.findings = h.findings || []
  out.accepted = h.accepted || []
  out.faults = h.faults || []
  out.writes = h.writes
  out.reference = `${STAGE_REFS}${h.stage}.md`
  return '```json\n' + JSON.stringify(out, null, 2) + '\n```\n'
}

const stats = {
  attempts: [],
  agents: { total: 0, byType: {}, maxConcurrent: 0 },
  retries: [],
  priceCalls: [],
  faults: [],
  revision: [],
}
let inFlight = 0

// Every agent runs as one of the build-guide types (R-6): a default agent would see every MCP tool. An
// agent that dies, is skipped or throws returns null, which counts as a failed attempt (section 5.4).
async function run(agentType, prompt, opts) {
  stats.agents.total += 1
  stats.agents.byType[agentType] = (stats.agents.byType[agentType] || 0) + 1
  inFlight += 1
  stats.agents.maxConcurrent = Math.max(stats.agents.maxConcurrent, inFlight)
  try {
    const result = await agent(prompt, { ...opts, agentType })
    return isObj(result) ? result : null
  } catch (e) {
    log(`${opts.label}: the agent failed (${e && e.message ? e.message : e}); counted as no result`)
    return null
  } finally {
    inFlight -= 1
  }
}

// At most `limit` thunks in flight, in order; each result in its thunk's place.
async function limited(thunks, limit) {
  const out = thunks.map(() => null)
  let next = 0
  const worker = async () => {
    while (next < thunks.length) {
      const i = next
      next += 1
      out[i] = await thunks[i]()
    }
  }
  await parallel(Array.from({ length: Math.min(limit, thunks.length) }, () => worker))
  return out
}

const nullFinding = (stage, attempt) => ({
  code: 'null-result',
  message: `${stage} attempt ${attempt} returned no result: the agent died, was skipped or failed`,
})

function attemptEntry(stage, attempt, outcome, findings, agents, extra) {
  const entry = { stage, concept: conceptId, ...(extra || {}), attempt, agents: agents || 1, outcome, findings }
  stats.attempts.push(entry)
  return entry
}

const retried = (stage, count) => {
  if (count > 0) stats.retries.push({ stage, concept: conceptId, count })
}

// ---- Pricing state (section 9) -----------------------------------------------------------------------

let pricingStopped = null
function notePriceCalls(stage, res) {
  for (const call of Array.isArray(res.priceCalls) ? res.priceCalls : []) {
    if (!isObj(call)) continue
    const entry = {
      at: isText(call.at) ? call.at : null,
      stage,
      tool: String(call.tool ?? ''),
      item: String(call.item ?? ''),
      outcome: isText(call.outcome) ? call.outcome : 'error',
    }
    stats.priceCalls.push(entry)
    if (mode === 'offline') log(`${stage} reported a price call in an offline run: ${entry.tool} ${entry.item}`)
    if (!pricingStopped && PRICING_STOPS.includes(entry.outcome)) pricingStopped = entry.outcome
  }
}

function pricingLine(what) {
  if (mode === 'offline') {
    return 'Offline run: make no price call; every price is unavailable with note "offline run", league null, dated the run folder\'s date (.claude/skills/build-guide/references/pricing.md).'
  }
  if (pricingStopped) {
    return `Pricing has stopped for this run (a price call came back ${pricingStopped}): make no price call; every item still to price is unavailable.`
  }
  return `Price ${what} at the pace .claude/skills/build-guide/references/pricing.md sets, reusing this run's entries first, and report every price-tool call in priceCalls.`
}

let leagueUnverified = false

// ---- Schemas of the steps' returns -------------------------------------------------------------------

const PRICE_CALLS = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      at: { type: ['string', 'null'] },
      tool: { type: 'string' },
      item: { type: 'string' },
      outcome: { type: 'string' },
    },
    required: ['tool', 'item', 'outcome'],
  },
}
const FINDINGS = {
  type: 'array',
  items: {
    type: 'object',
    properties: { part: { type: 'string' }, code: { type: 'string' }, stage: { type: 'string' }, message: { type: 'string' } },
    required: ['part', 'code', 'message'],
  },
}
const FAULTS_APPLIED = {
  type: 'array',
  items: { type: 'object', properties: { id: { type: 'string' }, observed: { type: 'string' } }, required: ['id', 'observed'] },
}
const PART = { type: 'string', enum: VERDICTS }
const partsSchema = (parts) => ({
  type: 'object',
  properties: Object.fromEntries(parts.map((p) => [p, PART])),
  required: parts,
})

const D1_SCHEMA = {
  type: 'object',
  properties: {
    claim: { type: 'string', enum: ['done', 'infeasible'] },
    reason: { type: 'string' },
    compiles: { type: 'integer' },
    leagueUnverified: { type: 'boolean' },
    priceCalls: PRICE_CALLS,
  },
  required: ['claim', 'priceCalls'],
}
const D1_GATE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: partsSchema(GATE_PARTS['D1-gate']),
    findings: FINDINGS,
    basis: {
      type: 'object',
      properties: { floor: { type: 'array' }, budget: { type: 'object' }, rolledSkill: { type: 'array' } },
      required: ['floor', 'budget', 'rolledSkill'],
    },
    recordPath: { type: 'string' },
    priceCalls: PRICE_CALLS,
    faultsApplied: FAULTS_APPLIED,
  },
  required: ['verdict', 'findings', 'basis', 'priceCalls'],
}
const D2_SCHEMA = {
  type: 'object',
  properties: {
    claim: { type: 'string', enum: ['done'] },
    stages: { type: 'array', items: { type: 'string' } },
    compiles: { type: 'integer' },
    priceCalls: PRICE_CALLS,
  },
  required: ['claim', 'priceCalls'],
}
const D2_GATE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: partsSchema(GATE_PARTS['D2-gate']),
    findings: FINDINGS,
    recordPath: { type: 'string' },
  },
  required: ['verdict', 'findings'],
}
const FINAL_SCHEMA = {
  type: 'object',
  properties: {
    compiled: { type: 'boolean' },
    errors: { type: 'array', items: { type: 'string' } },
    recordPath: { type: ['string', 'null'] },
    pobFile: { type: ['string', 'null'] },
    importCode: { type: ['string', 'null'] },
    verdict: partsSchema(['v1', 'v2']),
    findings: FINDINGS,
  },
  required: ['compiled', 'errors', 'verdict', 'findings'],
}
const W1_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    importCode: { type: 'string' },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'gaps'],
}
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    stage: { type: 'string', enum: ['V3', 'V4'] },
    lens: { type: 'string', enum: LENSES },
    concept: { type: 'string' },
    pass: { type: 'integer' },
    mode: { type: 'string', enum: ['offline', 'online'] },
    coverage: { type: 'object' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          artifact: { type: 'string' },
          location: { type: 'string' },
          claim: { type: 'string' },
          issue: { type: 'string' },
          evidence: { type: 'string' },
          owner: { type: 'string', enum: ['W1', 'D1', 'D2', 'dossier-fix'] },
          status: { type: 'string', enum: ['unresolved', 'accepted-offline'] },
        },
        required: ['id', 'artifact', 'location', 'claim', 'issue', 'evidence', 'owner', 'status'],
      },
    },
    verdict: { type: 'string', enum: ['pass', 'fail'] },
  },
  required: ['stage', 'concept', 'pass', 'mode', 'coverage', 'findings', 'verdict'],
}

// ---- Gate verdicts (references/gates.md) --------------------------------------------------------------

/** The verdict and findings a gate step returned, every part present and every finding with part and code. */
function normalized(gate, res) {
  const verdict = {}
  const findings = []
  for (const f of Array.isArray(res.findings) ? res.findings : []) {
    if (!isObj(f) || !isText(f.code)) continue
    findings.push({
      part: isText(f.part) ? f.part : 'compiled',
      code: f.code,
      ...(isText(f.stage) ? { stage: f.stage } : {}),
      message: isText(f.message) ? f.message : f.code,
    })
  }
  for (const part of GATE_PARTS[gate]) {
    const said = isObj(res.verdict) ? res.verdict[part] : undefined
    verdict[part] = VERDICTS.includes(said) ? said : 'fail'
    if (!VERDICTS.includes(said)) findings.push({ part, code: 'no-verdict', message: `the gate step returned no verdict for ${part}` })
  }
  return { verdict, findings }
}

/**
 * The failures that stand: every part that isn't a pass (a budget may be unverified, D-164), less the parts
 * whose every finding the user accepted. A compile failure is never accepted (section 5.4), and a failing
 * part with no finding stands with one that says so.
 */
function openFailures(gate, verdict, findings) {
  const out = []
  for (const part of GATE_PARTS[gate]) {
    const v = verdict[part]
    if (v === 'pass' || (part === 'budget' && v === 'unverified')) continue
    // Nothing compiled, so nothing could be checked: the compile failure says why.
    if (part !== 'compiled' && v === 'unverified' && verdict.compiled !== 'pass') continue
    const mine = findings.filter((f) => f.part === part)
    const open = mine.filter((f) => part === 'compiled' || !coveredGate(f))
    if (mine.length > 0 && open.length === 0 && v === 'fail') continue
    out.push(...(open.length > 0 ? open : [{ part, code: `${part}-${v}`, message: `the gate returned ${part}: ${v} with no finding saying why` }]))
  }
  return out
}

const evidenceOf = (gate, attempt, findings) => findings.map((f) => ({ gate, attempt, ...f }))

// ---- Prompts -----------------------------------------------------------------------------------------

const closing = "Follow your stage reference (the header's \"reference\") and end with the JSON it names."
const planPath = `${runFolderRel}/plan.json`
const retryLine = (attempt, what) =>
  attempt > 1 ? `- Attempt ${attempt}: the header's findings are ${what}; fix what each names. A finding in the header's accepted needs no fix.` : null

function d1Prompt(attempt, findings, guided, fresh) {
  const lines = [
    `D1 for concept ${conceptId}: design both endgame variants of the build guide, the budget variant first (endgame first, D-104).`,
    '',
    `- The concept is the "### ${conceptId}: <title>" entry of dossier.md; its skeleton is concepts/${conceptId}/plan.json, with its compile record beside it.`,
    fresh
      ? `- Write plan.json whole, from this concept's skeleton: a plan.json already in the run folder belongs to an earlier design and is replaced.`
      : '- Edit plan.json (the header\'s writes): keep what the findings don\'t touch, and any campaign stage D2 wrote.',
    `- Validate with guide_run {validate: "${planPath}"}. Compile only measure-only: compile_plan {plan_path: "${planPath}", measure_only: true}, as often as you need, with stages naming a subset when you measure a line (two stages). Never a final compile.`,
    `- ${pricingLine('every filled slot and tree jewel of both variants (rares as affix-target searches)')}`,
    '- League: take it as your stage reference says; never from a skeleton or dossier line that marks it unverified, and never a guess such as Standard.',
  ]
  const retry = retryLine(attempt, 'the earlier attempts\' gate findings')
  if (retry) lines.push(retry)
  if (guided) lines.push('- A guided retry: the header\'s findings end with the user\'s guidance (code "user-guidance"). Follow it.')
  lines.push('', closing)
  return header({ stage: 'D1', attempt, compile: 'measure-only', findings, accepted: ACCEPTED, writes: ['plan.json'] }) + '\n' + lines.join('\n') + '\n'
}

function d1GatePrompt(attempt, faults) {
  const repricing = mode === 'online' && !pricingStopped
  const lines = [
    `D1 gate for concept ${conceptId}: a fresh check of plan.json's endgame variants.`,
    '',
    repricing
      ? '- First the final re-price pass: call each price entry of plan.json that is unavailable because of a rate limit once more, and update it.'
      : mode === 'offline'
        ? '- Offline run: no re-price pass and no price call.'
        : `- Pricing has stopped for this run (a price call came back ${pricingStopped}): no re-price pass and no price call.`,
    `- Compile the whole plan measure-only: compile_plan {plan_path: "${planPath}", measure_only: true}. Read compile-record.json and return the verdict with its basis (.claude/skills/build-guide/references/gates.md).`,
    "- Report every failure the record shows, accepted ones included: the workflow sets aside a failure the header's accepted lists.",
  ]
  if (faults.some((d) => d.id === 'FI-2')) {
    lines.push('- Fault directive FI-2 applies to this attempt: before the compile, set the first endgame stage\'s level to 1 (and its loadoutName\'s (L<n>) to (L1)) in plan.json, as the stage reference says. Never work around it.')
  }
  if (faults.some((d) => d.id === 'FI-3')) {
    lines.push('- Fault directive FI-3 applies to this attempt: run the gate as usual and report FI-3 in faultsApplied; the workflow forces the outcome.')
  }
  lines.push('', closing)
  const writes = repricing || faults.some((d) => d.id === 'FI-2') ? ['plan.json'] : []
  return header({ stage: 'D1-gate', attempt, compile: 'measure-only', accepted: ACCEPTED, faults, writes }) + '\n' + lines.join('\n') + '\n'
}

function d2Prompt(attempt, findings, guided) {
  const lines = [
    `D2 for concept ${conceptId}: plan the campaign stages backward from the endgame variants in plan.json (D-104).`,
    '',
    '- Add the campaign stages to plan.json (the header\'s writes), before the endgame stages; leave the endgame stages as D1 wrote them.',
    `- Validate with guide_run {validate: "${planPath}"}. Compile only measure-only: compile_plan {plan_path: "${planPath}", measure_only: true}, with stages naming a subset when that is all you need. Never a final compile.`,
    `- ${pricingLine('the campaign uniques')}`,
  ]
  const retry = retryLine(attempt, 'the earlier attempts\' gate findings')
  if (retry) lines.push(retry)
  if (guided) lines.push('- A guided retry: the header\'s findings end with the user\'s guidance (code "user-guidance"). Follow it.')
  lines.push('', closing)
  return header({ stage: 'D2', attempt, compile: 'measure-only', findings, accepted: ACCEPTED, writes: ['plan.json'] }) + '\n' + lines.join('\n') + '\n'
}

function d2GatePrompt(attempt) {
  const lines = [
    `D2 gate for concept ${conceptId}: a fresh check of the whole plan, every stage.`,
    '',
    `- Compile the whole plan measure-only: compile_plan {plan_path: "${planPath}", measure_only: true}. Read compile-record.json and return the verdict: compiled, and V1 (tree continuity included) and V2 for every stage.`,
    '- Don\'t run the final compile in this call: the workflow starts it once this verdict passes.',
    "- Report every failure the record shows, accepted ones included: the workflow sets aside a failure the header's accepted lists.",
    '',
    closing,
  ]
  return header({ stage: 'D2-gate', attempt, compile: 'measure-only', accepted: ACCEPTED, writes: [] }) + '\n' + lines.join('\n') + '\n'
}

function finalPrompt(attempt) {
  const lines = [
    `D2 gate for concept ${conceptId}, the final compile: this attempt's measure-only check passed.`,
    '',
    `- Run compile_plan {plan_path: "${planPath}", build_name: "${buildName}"} once, the whole plan and not measure-only. It writes the PoB file into the builds folder, and compile-record.json with importCode.`,
    '- Read the new record and return its V1 and V2 verdicts, its PoB file and its import code. If the compile is refused or fails, report its error lines; never retry it or work around it.',
    '',
    closing,
  ]
  return header({ stage: 'D2-gate', attempt, compile: 'final', accepted: ACCEPTED, writes: [] }) + '\n' + lines.join('\n') + '\n'
}

function w1Prompt(attempt, findings, guided) {
  const lines = [
    `W1 for concept ${conceptId}: write guide.md from plan.json, the final compile-record.json (its ledger values included), dossier.md and the guide template (${TEMPLATE}).`,
    '',
    '- Write only guide.md (the header\'s writes). Copy the import code from compile-record.json\'s importCode exactly.',
  ]
  if (leagueUnverified) lines.push('- The league couldn\'t be verified (trade was unreachable when D1 ran): say so in "Versions, prices and import code".')
  if (ACCEPTED.length > 0) lines.push('- The header\'s accepted lists findings the user accepted: the guide states each under "Accepted failures", as the stage reference says.')
  const retry = retryLine(attempt, 'the earlier attempts\' findings')
  if (retry) lines.push(retry)
  if (guided) lines.push('- A guided retry: the header\'s findings end with the user\'s guidance (code "user-guidance"). Follow it.')
  // The budget totals and the floor, budget and rolled-skill findings come from the D1 gate (section 8).
  const d1 = [...gateVerdicts].reverse().find((g) => g.stage === 'D1-gate')
  if (d1) {
    const budget = isObj(d1.basis) && isObj(d1.basis.budget) ? d1.basis.budget : null
    const summary = {
      attempt: d1.attempt,
      verdict: d1.verdict,
      budget: budget ? { rates: budget.rates ?? [], totals: budget.totals ?? [], nonBudget: budget.nonBudget ?? [] } : null,
      findings: d1.findings.filter((f) => ['floor', 'budget', 'rolledSkill'].includes(f.part)),
    }
    lines.push('', "The D1 gate's last verdict (its budget totals and rates, and its floor, budget and rolled-skill findings):", '', '```json', JSON.stringify(summary, null, 2), '```')
  } else {
    lines.push(`- This workflow ran no D1 gate (it resumed past D1): take the budget totals and findings from the highest-numbered reports/gates/D1-gate-${conceptId}-a<n>.json.`)
  }
  lines.push('', closing)
  return header({ stage: 'W1', attempt, compile: 'none', findings, accepted: ACCEPTED, writes: ['guide.md'] }) + '\n' + lines.join('\n') + '\n'
}

// A V3 or V4 prompt is the header and fixed text: nothing a D1, D2 or W1 step wrote (R-5, D-142).
function verifyPrompt(job, pass, attempt, findings) {
  const lines =
    job.stage === 'V3'
      ? [`V3 (provenance) for concept ${conceptId}, pass ${pass}: check that every claim in plan.json, dossier.md and guide.md carries a well-formed source tag.`]
      : [`V4, lens "${job.lens}", for concept ${conceptId}, pass ${pass}: check that the claims are true, through this lens alone.`]
  lines.push(
    '',
    '- Read the artifacts yourself, from the run folder: this prompt carries none of their text.',
    '- You write nothing: your report is your return.',
  )
  if (attempt > 1) lines.push(`- Attempt ${attempt}: an earlier attempt returned no report.`)
  lines.push('', "Follow your stage reference (the header's \"reference\") and end with the report it names.")
  return (
    header({ stage: job.stage, attempt, lens: job.lens, pass, compile: 'none', findings, accepted: [], writes: [] }) + '\n' + lines.join('\n') + '\n'
  )
}

// ---- Gate steps ----------------------------------------------------------------------------------------

const gateVerdicts = []
const v3Reports = []
const v4Reports = []

async function runD1Gate(attempt) {
  const faults = faultsFor(attempt)
  for (const d of faults) faultTally[FAULTS.indexOf(d)].targeted += 1
  const res = await run(COORDINATOR, d1GatePrompt(attempt, faults), {
    label: `D1-gate ${conceptId} attempt ${attempt}`,
    phase: 'D1 endgame',
    schema: D1_GATE_SCHEMA,
  })
  if (res === null) {
    attemptEntry('D1-gate', attempt, 'null-result', 1)
    return null
  }
  notePriceCalls('D1-gate', res)
  const { verdict, findings } = normalized('D1-gate', res)
  const file = { stage: 'D1-gate', concept: conceptId, attempt, verdict, findings, basis: isObj(res.basis) ? res.basis : null }
  if (isText(res.recordPath)) file.recordPath = res.recordPath

  // FI-2 counts as applied when the step reports it or V1 fails; FI-3 when the step returned at all, since
  // the workflow forces the outcome (section 11.3).
  let forced = false
  const reported = Array.isArray(res.faultsApplied) ? res.faultsApplied.filter(isObj) : []
  for (const d of faults) {
    const tally = faultTally[FAULTS.indexOf(d)]
    const said = reported.find((r) => r.id === d.id)
    if (d.id === 'FI-3') {
      forced = true
      tally.applied += 1
      tally.observed = `the D1 gate's outcome was forced to infeasible: FI-3 (injected)`
      continue
    }
    const v1 = findings.find((f) => f.part === 'v1')
    if (said || v1) {
      tally.applied += 1
      tally.observed = said && isText(said.observed) ? said.observed : v1 ? v1.message : 'FI-2 applied'
    } else {
      log(`D1-gate attempt ${attempt}: FI-2 was in the header, but the step reported no application and V1 found nothing`)
    }
  }
  if (forced) file.forced = 'FI-3'
  gateVerdicts.push(file)
  const open = openFailures('D1-gate', verdict, findings)
  const entry = attemptEntry('D1-gate', attempt, open.length === 0 && !forced ? 'pass' : 'fail', findings.length)
  return { attempt, file, open, entry, forced }
}

async function runD2Gate(attempt) {
  const res = await run(COORDINATOR, d2GatePrompt(attempt), {
    label: `D2-gate ${conceptId} attempt ${attempt}`,
    phase: 'D2 campaign',
    schema: D2_GATE_SCHEMA,
  })
  if (res === null) {
    attemptEntry('D2-gate', attempt, 'null-result', 1)
    return null
  }
  const { verdict, findings } = normalized('D2-gate', res)
  const file = { stage: 'D2-gate', concept: conceptId, attempt, verdict, findings }
  if (isText(res.recordPath)) file.recordPath = res.recordPath
  let agents = 1

  // The final compile (section 5.3 step 4) runs only once this attempt's measure-only verdict passes, so no
  // header before that pass carries compile "final" (AC-W8). It belongs to this gate attempt: its result goes
  // into this attempt's verdict as finalCompile, and its failure is this attempt's failure.
  if (openFailures('D2-gate', verdict, findings).length === 0) {
    agents = 2
    const fin = await run(COORDINATOR, finalPrompt(attempt), {
      label: `D2-gate ${conceptId} attempt ${attempt} final compile`,
      phase: 'D2 campaign',
      schema: FINAL_SCHEMA,
    })
    if (fin === null) {
      file.finalCompile = null
      verdict.compiled = 'fail'
      findings.push({ part: 'compiled', code: 'final-compile', message: `the final compile of attempt ${attempt} returned no result: the agent died, was skipped or failed` })
    } else {
      const errors = (Array.isArray(fin.errors) ? fin.errors : []).filter(isText).map((e) => e.trim())
      file.finalCompile = {
        compiled: fin.compiled === true && errors.length === 0,
        errors,
        recordPath: isText(fin.recordPath) ? fin.recordPath : null,
        pobFile: isText(fin.pobFile) ? fin.pobFile : null,
        importCode: isText(fin.importCode) ? fin.importCode : null,
      }
      if (!file.finalCompile.compiled) {
        verdict.compiled = 'fail'
        const lines = errors.length > 0 ? errors : [`the final compile reported compiled: ${JSON.stringify(fin.compiled)} with no error line`]
        for (const e of lines) {
          const m = /^stage ([A-Za-z0-9]+): /.exec(e)
          findings.push({ part: 'compiled', code: 'final-compile', ...(m ? { stage: m[1] } : {}), message: e })
        }
      } else {
        // The final record's own V1 and V2 verdicts, which the run checker reads.
        const final = normalized('D2-gate', { verdict: { compiled: 'pass', ...(isObj(fin.verdict) ? fin.verdict : {}) }, findings: fin.findings })
        for (const part of ['v1', 'v2']) if (final.verdict[part] !== 'pass') verdict[part] = final.verdict[part]
        for (const f of final.findings) if (!findings.some((g) => g.part === f.part && g.code === f.code && g.stage === f.stage)) findings.push(f)
      }
    }
  }
  gateVerdicts.push(file)
  const open = openFailures('D2-gate', verdict, findings)
  const entry = attemptEntry('D2-gate', attempt, open.length === 0 ? 'pass' : 'fail', findings.length, agents)
  return { attempt, file, open, entry, forced: false }
}

// ---- A design phase: the producer (D1 or D2), then its fresh gate (section 5.3, 5.4) --------------------

/**
 * Runs a producer and its gate until the gate passes, or the retries run out. `how` is "normal" (up to 2
 * retries of each), "guided" (one producer run outside the cap with the user's guidance, D-236) or
 * "accepted" (the gate alone, once more, outside the cap, with the findings the user accepted). A producer
 * that returns nothing re-runs; a gate that returns nothing re-runs on its own; a failing verdict re-runs the
 * producer with its findings, and the fresh gate after it is no retry of the gate.
 */
async function designPhase(producer, how, firstFindings, runProducer, runGate) {
  const gate = GATE_OF[producer]
  // Cap-counted retries left and used, of the producer and of the gate (D-127; none outside the cap, D-236).
  const left = how === 'normal' ? { producer: RETRIES, gate: RETRIES } : { producer: 0, gate: 0 }
  const used = { producer: 0, gate: 0 }
  const evidence = []
  const findings = firstFindings.slice()
  let claim = { claim: 'done', reason: null, attempt: null }
  let needProducer = how !== 'accepted'
  let guided = how === 'guided'
  // The producer writes the plan anew until one of its attempts in a fresh run has returned.
  let fresh = how === 'normal' && !attempts[producer]
  const end = (result) => {
    retried(producer, used.producer)
    retried(gate, used.gate)
    return result
  }
  const escalated = (stage) => end({ status: 'escalated', stage, evidence })

  for (;;) {
    if (needProducer) {
      const attempt = nextAttempt(producer)
      const res = await runProducer(attempt, findings.slice(), guided, fresh)
      guided = false
      if (res === null) {
        const f = nullFinding(producer, attempt)
        attemptEntry(producer, attempt, 'null-result', 1)
        evidence.push({ gate: producer, attempt, ...f })
        findings.push({ attempt, ...f })
        if (left.producer === 0) return escalated(producer)
        left.producer -= 1
        used.producer += 1
        continue
      }
      fresh = false
      claim = { claim: res.claim === 'infeasible' ? 'infeasible' : 'done', reason: isText(res.reason) ? res.reason : null, attempt }
      attemptEntry(producer, attempt, 'done', 0)
    }
    needProducer = true

    // The gate, fresh after every producer attempt (no retry of the gate), and re-run on its own, as a
    // retry, while it returns nothing.
    let g = null
    for (;;) {
      const attempt = nextAttempt(gate)
      g = await runGate(attempt)
      if (g !== null) break
      evidence.push({ gate, attempt, ...nullFinding(gate, attempt) })
      if (left.gate === 0) return escalated(gate)
      left.gate -= 1
      used.gate += 1
    }

    if (g.forced) {
      // FI-3 (section 11.3): control flow only, back to checkpoint 1.
      g.entry.outcome = 'infeasible'
      return end({ status: 'infeasible', stage: gate, evidence: [{ gate, attempt: g.attempt, code: 'FI-3', message: 'FI-3 (injected)' }] })
    }
    if (g.open.length === 0) return end({ status: 'pass' })

    evidence.push(...evidenceOf(gate, g.attempt, g.open))
    const hard = g.open.some((f) => HARD_PARTS.includes(f.part))
    const claimed = claim.claim === 'infeasible' && claim.reason !== null
      ? [{ gate: producer, attempt: claim.attempt, code: 'claimed-infeasible', message: claim.reason }]
      : []
    // Section 5.3's table: only floor, budget or rolledSkill failing, with D1 claiming infeasible, is
    // infeasible at once (D-141), with the verdict as evidence.
    if (!hard && claim.claim === 'infeasible') {
      g.entry.outcome = 'infeasible'
      return end({ status: 'infeasible', stage: gate, evidence: [...evidenceOf(gate, g.attempt, g.open), ...claimed] })
    }
    if (left.producer === 0) {
      // Out of retries: a compile, V1 or V2 failure escalates; a floor, budget or rolled-skill failure is
      // infeasible. After a guided retry, any failure escalates again (D-236).
      if (hard || how === 'guided') {
        g.entry.outcome = 'escalated'
        return escalated(gate)
      }
      g.entry.outcome = 'infeasible'
      return end({ status: 'infeasible', stage: gate, evidence: evidenceOf(gate, g.attempt, g.open) })
    }
    left.producer -= 1
    used.producer += 1
    findings.push(...g.open.map((f) => ({ attempt: g.attempt, ...f })))
  }
}

async function runD1(attempt, findings, guided, fresh) {
  const res = await run(COORDINATOR, d1Prompt(attempt, findings, guided, fresh), {
    label: `D1 ${conceptId} attempt ${attempt}`,
    phase: 'D1 endgame',
    schema: D1_SCHEMA,
  })
  if (res !== null) {
    notePriceCalls('D1', res)
    if (res.leagueUnverified === true) leagueUnverified = true
  }
  return res
}

async function runD2(attempt, findings, guided) {
  const res = await run(COORDINATOR, d2Prompt(attempt, findings, guided), {
    label: `D2 ${conceptId} attempt ${attempt}`,
    phase: 'D2 campaign',
    schema: D2_SCHEMA,
  })
  if (res !== null) notePriceCalls('D2', res)
  return res
}

// ---- W1: the guide -------------------------------------------------------------------------------------

async function runW1(how, firstFindings) {
  const findings = firstFindings.slice()
  const evidence = []
  const tries = how === 'normal' ? 1 + RETRIES : 1
  for (let i = 0; i < tries; i += 1) {
    const attempt = nextAttempt('W1')
    const res = await run(WRITER, w1Prompt(attempt, findings.slice(), how === 'guided' && i === 0), {
      label: `W1 ${conceptId} attempt ${attempt}`,
      phase: 'W1 guide',
      schema: W1_SCHEMA,
    })
    if (res !== null) {
      attemptEntry('W1', attempt, 'done', 0)
      if (how === 'normal') retried('W1', i)
      for (const gap of Array.isArray(res.gaps) ? res.gaps.filter(isText) : []) log(`W1: ${gap}`)
      return { status: 'pass' }
    }
    attemptEntry('W1', attempt, 'null-result', 1)
    const f = nullFinding('W1', attempt)
    evidence.push({ gate: 'W1', attempt, ...f })
    findings.push({ attempt, ...f })
  }
  if (how === 'normal') retried('W1', RETRIES)
  return { status: 'escalated', stage: 'W1', evidence }
}

// ---- V3 and V4 (section 5.3 steps 6 and 7) -------------------------------------------------------------

// One verification pass: V3 and the three lenses, at most 3 in flight (D-161); one that returns nothing
// re-runs, together with the others that did, up to 2 retries.
async function verifyPass(pass) {
  const jobs = [{ stage: 'V3' }, ...LENSES.map((lens) => ({ stage: 'V4', lens }))]
  const reports = jobs.map(() => null)
  const notes = jobs.map(() => [])
  const tries = jobs.map(() => 0)
  let pending = jobs.map((_, i) => i)
  for (let attempt = 1; attempt <= 1 + RETRIES && pending.length > 0; attempt += 1) {
    const batch = pending
    const results = await limited(
      batch.map((i) => () => {
        const job = jobs[i]
        return run(job.stage === 'V3' ? PROVENANCE : VERIFIER, verifyPrompt(job, pass, attempt, notes[i].slice()), {
          label: `${job.stage}${job.lens ? ` ${job.lens}` : ''} ${conceptId} pass ${pass} attempt ${attempt}`,
          phase: 'V3 and V4',
          schema: REPORT_SCHEMA,
        })
      }),
      FAN_OUT,
    )
    pending = []
    results.forEach((r, k) => {
      const i = batch[k]
      const job = jobs[i]
      tries[i] = attempt
      const extra = { ...(job.lens ? { lens: job.lens } : {}), pass }
      if (r === null) {
        attemptEntry(job.stage, attempt, 'null-result', 1, 1, extra)
        notes[i].push({ attempt, ...nullFinding(job.stage, attempt) })
        pending.push(i)
        return
      }
      const findings = Array.isArray(r.findings) ? r.findings.filter(isObj) : []
      const open = findings.filter((f) => f.status === 'unresolved' && !coveredReport(f, job.stage))
      attemptEntry(job.stage, attempt, open.length === 0 ? 'pass' : 'fail', findings.length, 1, extra)
      reports[i] = r
      ;(job.stage === 'V3' ? v3Reports : v4Reports).push(r)
    })
  }
  // One retries entry per stage: V3's re-runs, and the V4 lenses' re-run rounds.
  retried('V3', tries[0] - 1)
  retried('V4', Math.max(...tries.slice(1)) - 1)
  return { jobs, reports }
}

/**
 * Section 5.5's routing re-runs each finding's owner, which WU-46 wires in. Until then an unresolved finding
 * ends the flow escalated, with the findings as evidence, so the skill shows them to the user.
 */
function routeFindings(pass, unresolved) {
  log(`pass ${pass}: ${unresolved.length} unresolved finding(s); routing them to their owners (section 5.5) arrives with WU-46`)
  return {
    status: 'escalated',
    stage: unresolved[0].gate,
    evidence: unresolved,
  }
}

async function verify(pass) {
  const { jobs, reports } = await verifyPass(pass)
  const dead = jobs.filter((_, i) => reports[i] === null)
  if (dead.length > 0) {
    return {
      status: 'escalated',
      stage: dead[0].stage,
      evidence: dead.map((j) => ({ gate: j.stage, ...(j.lens ? { lens: j.lens } : {}), pass, code: 'null-result', message: `${j.stage}${j.lens ? ` (${j.lens})` : ''} returned no report in ${1 + RETRIES} attempts` })),
    }
  }
  const unresolved = []
  reports.forEach((r, i) => {
    for (const f of Array.isArray(r.findings) ? r.findings.filter(isObj) : []) {
      if (f.status === 'unresolved' && !coveredReport(f, jobs[i].stage)) unresolved.push({ gate: jobs[i].stage, ...(jobs[i].lens ? { lens: jobs[i].lens } : {}), pass, ...f })
    }
  })
  if (unresolved.length > 0) return routeFindings(pass, unresolved)
  return { status: 'ready' }
}

// ---- The flow -------------------------------------------------------------------------------------------

function finish(status, extra) {
  stats.faults = FAULTS.flatMap((d, i) => {
    const t = faultTally[i]
    if (t.targeted === 0) return []
    return [{
      id: d.id,
      target: { concepts: d.concepts, persistent: d.persistent },
      applied: t.applied,
      observed: t.observed ?? `not applied: ${t.targeted} D1 gate header(s) carried it, and no step reported it`,
    }]
  })
  return {
    status,
    ...(extra || {}),
    ...(ACCEPTED.length > 0 ? { accepted: ACCEPTED } : {}),
    gateVerdicts,
    v3Reports,
    v4Reports,
    stats,
  }
}

const ended = (r) => finish(r.status, { stage: r.stage, evidence: r.evidence })

// Where the flow starts: at D1, or where a resume puts it (section 5.3 "Resuming").
const guidance = resume && resume.reason === 'guided-retry'
  ? [...withGate(resume.findings, gateFor(resume.stage)), { code: 'user-guidance', message: resume.guidance.trim() }]
  : []
const from = !resume ? 'D1' : gateFor(resume.stage)
const startAt = { D1: 0, 'D1-gate': 0, 'D2-gate': 1, W1: 2, V3: 3, V4: 3 }[from]
const howAt = (step) => (resume && step === startAt ? (resume.reason === 'guided-retry' ? 'guided' : 'accepted') : 'normal')
const firstFindingsAt = (step) => (resume && step === startAt && resume.reason === 'guided-retry' ? guidance : [])

if (resume && resume.reason === 'accepted' && (from === 'V3' || from === 'V4')) {
  // After a V3/V4 escalation, accepting it returns ready with the findings accepted (section 5.3).
  return finish('ready')
}
need(!(resume && resume.reason === 'accepted' && from === 'W1'), 'args.resume {reason: "accepted", stage: "W1"}: W1 escalates only when it returns nothing, so there is no guide to accept')
need(!(resume && resume.reason === 'guided-retry' && (from === 'V3' || from === 'V4')), 'args.resume {reason: "guided-retry"} for V3 or V4 re-routes the findings, which arrives with WU-46')

if (startAt <= 0) {
  phase('D1 endgame')
  const d1 = await designPhase('D1', howAt(0), firstFindingsAt(0), runD1, runD1Gate)
  if (d1.status !== 'pass') return ended(d1)
}
if (startAt <= 1) {
  phase('D2 campaign')
  const d2 = await designPhase('D2', howAt(1), firstFindingsAt(1), runD2, runD2Gate)
  if (d2.status !== 'pass') return ended(d2)
}
if (startAt <= 2) {
  phase('W1 guide')
  const w1 = await runW1(howAt(2), firstFindingsAt(2))
  if (w1.status !== 'pass') return ended(w1)
}
phase('V3 and V4')
const firstPass = 1 + (Number.isInteger(made.V3) ? made.V3 : 0)
const v = await verify(firstPass)
if (v.status !== 'ready') return ended(v)
return finish('ready')
