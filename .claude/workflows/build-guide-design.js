export const meta = {
  name: 'build-guide-design',
  description: 'The design-and-write half of a build-guide run, for one chosen concept: D1 designs and prices both endgame variants and a fresh D1 gate checks them; D2 plans the campaign backward from the endgame and a fresh D2 gate checks every stage, then the final compile runs; W1 writes the guide; V3 and the three V4 lenses check it, and each unresolved finding re-runs the step that wrote its claim; a checkpoint-2 revision re-runs the steps the user\'s requests map to',
  whenToUse: 'Only from the build-guide skill (.claude/skills/build-guide/SKILL.md) or its fallback, once per chosen concept, again to resume after an escalation, and again for each checkpoint-2 revision, with args {runFolder, runFolderRel, conceptId, mode, buildName, faults?, resume?, accepted?}',
  phases: [
    { title: 'Revision', detail: 'only when resumed for a checkpoint-2 revision: build-guide-coordinator revise-map maps each request to the step that owns it, and those steps re-run outside the retry cap' },
    { title: 'D1 endgame', detail: 'build-guide-coordinator: D1 writes and prices both endgame variants, then a fresh D1 gate re-prices, compiles measure-only and checks the compile, V1, V2, the survival floor, the budget and the rolled skill; up to 2 retries each' },
    { title: 'D2 campaign', detail: 'build-guide-coordinator: D2 plans the campaign stages backward from D1, then a fresh D2 gate compiles the whole plan measure-only and, once that passes, runs the final compile; up to 2 retries each' },
    { title: 'W1 guide', detail: 'build-guide-writer writes guide.md from the plan, the final record, the dossier and the guide template; up to 2 retries' },
    { title: 'V3 and V4', detail: 'one build-guide-provenance agent and three build-guide-verifier lenses (ledger, sources, prose), at most 3 in flight; an unresolved finding re-runs its owner (dossier-fix, D1, D2 or W1) and every step after it, one retry of that owner per round' },
    { title: 'Dossier fix', detail: 'build-guide-coordinator dossier-fix edits dossier.md for the V3 and V4 findings in it' },
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
//   findings}, from the escalation question; {reason: "revision", round, requests} from checkpoint 2.
//   - Every resume carries `attempts`, the attempts each stage of this concept already made ({"D1": 3,
//     "D1-gate": 5}; for V3 and V4 the highest pass), so attempt numbers, and with them the gate and report
//     files, continue: a null gate re-run can take a gate past attempt 3.
//   - A guided retry or an accepted resume also carries `retries`, the cap-counted retries each stage of
//     this concept already used ({"W1": 2}, the run log's retries[] of the concept), so routing a finding
//     never takes a stage past its 2 retries across workflow calls (D-127). A revision counts against no cap
//     (D-236): it starts afresh, and its retries carry `round`, the revision round, so the run log keeps
//     them apart. An escalation that came from a revision passes that `round` back with its resume.
//   - A guided retry of `revise-map` (an escalated revision) carries the revision's `round` and `requests`.
// - accepted: findings the user accepted at earlier escalations of this concept, as the run log records them
//   (each with its gate), so a later gate keeps them accepted.
//
// Returns {status, stage?, evidence?, accepted?, gateVerdicts, v3Reports, v4Reports, stats}:
// - status: "ready", "infeasible" (D1 can't meet the floor, the budget or the rolled-skill gate, D-141) or
//   "escalated" (the retries ran out, D-127); stage names the step that ended the flow;
// - evidence: the findings behind an "infeasible" or "escalated", each with its gate and attempt (a V3 or V4
//   finding with its gate, lens and pass);
// - accepted: every finding accepted for this concept, when there is one;
// - gateVerdicts: one D1 or D2 gate verdict per gate attempt that returned (references/gates.md);
// - v3Reports, v4Reports: every V3 and V4 report returned, in order (references/source-markers.md);
// - stats: {attempts, agents, retries, priceCalls, faults, revision} (references/run-log.md); after a
//   revision, revision is [{request, owner}].

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
// Findings that report on a passing part (references/gates.md): never failures.
const INFO_CODES = ['chaos-exception', 'near-ceiling']
const GATE_OF = { D1: 'D1-gate', D2: 'D2-gate' }
const RESUME_STAGES = ['D1', 'D1-gate', 'D2', 'D2-gate', 'W1', 'V3', 'V4', 'dossier-fix', 'revise-map']
// Section 5.5: the step that wrote a claim owns its finding, in run order, so the earliest re-runs first.
// dossier-fix is the dossier's owner (it edits dossier.md only); W1 owns guide.md; D1 an endgame stage, a
// ledger entry citing one, an endgame price; D2 a campaign stage, or a ledger entry citing only campaign
// stages.
const OWNERS = ['dossier-fix', 'D1', 'D2', 'W1']
// Section 7.4: every V3 and V4 finding has these fields, and each report the coverage counts of its kind.
const FINDING_FIELDS = ['id', 'artifact', 'location', 'claim', 'issue', 'evidence', 'owner', 'status']
const FINDING_STATUSES = ['unresolved', 'accepted-offline']
// Where a claim is (section 7.4): a plan claim, or a markdown definition.
const CLAIM_LOCATION = /stages\[\d+\]\.claims\[\d+\]|\[\^[^\]\s]+\]/
const COVERAGE = {
  V3: ['plan', 'dossier', 'guide'],
  ledger: ['entries', 'rederived'],
  sources: ['external', 'opened', 'data', 'dataChecked', 'pobDataEndgame', 'recheckedEndgame', 'pobDataOther', 'recheckedOther', 'prices', 'matched'],
  prose: [],
}

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
const counts = (v) => isObj(v) && Object.values(v).every((n) => Number.isInteger(n) && n >= 0)
if (resume) {
  need(['guided-retry', 'accepted', 'revision'].includes(resume.reason), 'args.resume.reason is "guided-retry", "accepted" or "revision"')
  need(
    counts(resume.attempts),
    'args.resume.attempts is required: the attempts each stage of this concept already made, {"<stage>": <count>} (for V3 and V4 the highest pass), counted from the run log\'s stages[], so attempt numbers and report files continue',
  )
  if (resume.reason !== 'revision') {
    need(RESUME_STAGES.includes(resume.stage), `args.resume.stage is one of ${RESUME_STAGES.join(', ')}`)
    need(Array.isArray(resume.findings), 'args.resume.findings is the escalation\'s findings')
    need(
      counts(resume.retries),
      'args.resume.retries is required for a guided retry or an accepted resume: the cap-counted retries each stage of this concept already used, {"<stage>": <count>}, from the run log\'s retries[], so no stage passes its 2 retries across workflow calls (D-127)',
    )
  }
  if (resume.reason === 'guided-retry') need(isText(resume.guidance), 'args.resume.guidance (the user\'s guidance) is required for a guided retry')
  if (resume.reason === 'revision' || resume.stage === 'revise-map' || resume.round !== undefined) {
    need(Number.isInteger(resume.round) && resume.round >= 1, 'args.resume.round is the revision round, from 1 (a revision, and a resume after one, carry it)')
  }
  if (resume.reason === 'revision' || resume.stage === 'revise-map') {
    need(
      Array.isArray(resume.requests) && resume.requests.length > 0 && resume.requests.every((q) => isText(q) || (isObj(q) && isText(q.text))),
      'args.resume.requests is the user\'s checkpoint-2 requests, a non-empty list of texts',
    )
  }
}
// The user's checkpoint-2 requests, each with an id the revise-map step maps by (section 5.3).
const REQUESTS = resume && Array.isArray(resume.requests)
  ? resume.requests.map((q, i) => ({ id: `r${i + 1}`, text: (isText(q) ? q : q.text).trim() }))
  : []

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
// A V3/V4 finding equals an accepted one only when it is the same finding (section 5.4): the same report, id
// and artifact, and the same location. A location "<H2 title>, line <n>" is compared by its section alone,
// since a regenerated guide moves its lines; every other form (a plan or record path, "<file> [^<id>]") whole.
// So a verifier that gives an accepted id to another issue doesn't get it excused.
const locationKey = (loc) => (typeof loc === 'string' ? loc.trim().replace(/,\s*line\s+\d+$/i, '') : null)
const coveredReport = (f, report) =>
  ACCEPTED.some(
    (a) => isText(a.id) && a.id === f.id && a.gate === report && isText(a.artifact) && a.artifact === f.artifact && locationKey(a.location) === locationKey(f.location),
  )
// What a V3 or V4 header carries of them: ids and places, never a finding's text, which quotes the artifacts
// the plan and guide steps wrote (R-5, D-142).
const ACCEPTED_REPORT_IDS = ACCEPTED.filter((a) => isText(a.id) && (a.gate === 'V3' || a.gate === 'V4')).map((a) => ({
  gate: a.gate,
  id: a.id,
  ...(isText(a.artifact) ? { artifact: a.artifact } : {}),
  ...(isText(a.location) ? { location: a.location } : {}),
}))

// Attempt numbers continue across a resume, so a resumed step never reuses an earlier attempt's file.
const made = resume ? { ...resume.attempts } : {}
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

// Cap-counted retries (D-127): at most 2 per (stage, concept), counted across the whole flow (a routed re-run
// spends one of its owner's, section 5.5) and across earlier workflow calls through args.resume.retries. A
// revision counts against no cap (D-236): its call starts afresh, and every retries entry it returns carries
// the revision round, as does a resume after it, so the run log keeps those apart.
const ROUND = resume && Number.isInteger(resume.round) ? resume.round : null
const spent = resume && resume.reason !== 'revision' && counts(resume.retries) ? { ...resume.retries } : {}
const spentHere = [] // [stage, count] in first-use order: this call's retries, for stats.retries
const retriesLeft = (stage) => Math.max(0, RETRIES - (spent[stage] || 0))
function spendRetry(stage) {
  spent[stage] = (spent[stage] || 0) + 1
  const mine = spentHere.find((e) => e[0] === stage)
  if (mine) mine[1] += 1
  else spentHere.push([stage, 1])
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
    verdict: partsSchema(['v1', 'v2']),
    findings: FINDINGS,
  },
  required: ['compiled', 'errors', 'verdict', 'findings'],
}
const W1_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'gaps'],
}
/** A V3 or V4 report (section 7.4), its stage, lens and coverage counts fixed by the job it answers. */
function reportSchema(job) {
  const keys = COVERAGE[job.lens || job.stage]
  return {
    type: 'object',
    properties: {
      stage: { type: 'string', enum: [job.stage] },
      ...(job.lens ? { lens: { type: 'string', enum: [job.lens] } } : {}),
      concept: { type: 'string' },
      pass: { type: 'integer' },
      mode: { type: 'string', enum: ['offline', 'online'] },
      coverage: {
        type: 'object',
        properties: Object.fromEntries(keys.map((k) => [k, { type: 'integer', minimum: 0 }])),
        required: keys,
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ...Object.fromEntries(FINDING_FIELDS.map((k) => [k, { type: 'string' }])),
            owner: { type: 'string', enum: OWNERS },
            status: { type: 'string', enum: FINDING_STATUSES },
          },
          required: FINDING_FIELDS,
        },
      },
      verdict: { type: 'string', enum: ['pass', 'fail'] },
    },
    required: ['stage', ...(job.lens ? ['lens'] : []), 'concept', 'pass', 'mode', 'coverage', 'findings', 'verdict'],
  }
}
const DOSSIER_FIX_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' } },
    notFixed: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'why'] },
    },
  },
  required: ['file', 'fixed', 'notFixed'],
}
const REVISE_MAP_SCHEMA = {
  type: 'object',
  properties: {
    mapping: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, owner: { type: 'string', enum: OWNERS }, why: { type: 'string' } },
        required: ['id', 'owner', 'why'],
      },
    },
  },
  required: ['mapping'],
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
    // A finding on a passing part's terms (the chaos exception, a budget near the ceiling) is information,
    // never a failure (references/gates.md).
    const mine = findings.filter((f) => f.part === part && !INFO_CODES.includes(f.code))
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
const GUIDED_LINE = '- A guided retry: the header\'s findings end with the user\'s guidance (code "user-guidance"). Follow it.'

/**
 * Why a step re-runs, when it isn't a first run or a plain retry (sections 5.3, 5.5): `ctx.why` is "routed"
 * (V3/V4 findings on claims it wrote) or "revision" (the user's checkpoint-2 requests).
 */
function whyLine(ctx, artifact) {
  if (ctx.why === 'routed') {
    return `- A routed re-run (slice 03 section 5.5): the header's findings are V3 and V4 findings on claims this step wrote in ${artifact} ({id, artifact, location, claim, issue, evidence}). Fix each claim at its location (its text, its number or its source, or remove it when nothing supports it), and keep what no finding names.`
  }
  if (ctx.why === 'revision') {
    return `- A checkpoint-2 revision (D-236): the header's findings are the user's requests for ${artifact} (code "user-request"). Make each change, and keep what no request names.`
  }
  return null
}

/**
 * When an earlier owner re-ran in this round (`ctx.upstream`), the step's inputs changed under it (section
 * 5.5): W1 writes the guide anew from the current plan and record, D2 re-plans the campaign against D1's new
 * endgame, and only then applies its own findings or requests (D-236).
 */
function upstreamLine(ctx, artifact) {
  const upstream = Array.isArray(ctx.upstream) ? ctx.upstream : []
  if (upstream.length === 0) return null
  if (artifact === 'guide.md') {
    return `- ${upstream.join(' and ')} re-ran in this round, so plan.json and compile-record.json changed: write guide.md anew from them, every section, number, loadout name and the import code from the current plan and record; then make the changes the header's findings ask for, if any.`
  }
  return `- ${upstream.join(' and ')} re-ran in this round, so the endgame stages changed: re-plan the campaign stages backward from them (the last campaign stage leads into the new endgame trees, gems and gear); then make the changes the header's findings ask for.`
}

/** The lines on why a step runs and what its header's findings are (sections 5.4, 5.5). */
function reasonLines(attempt, ctx, artifact, what) {
  const out = [upstreamLine(ctx, artifact), whyLine(ctx, artifact)].filter(Boolean)
  if (!ctx.why) {
    const retry = retryLine(attempt, what)
    if (retry) out.push(retry)
  }
  if (ctx.guided) out.push(GUIDED_LINE)
  return out
}

/** D1's and D2's lines on what their header's findings are, by why the step runs (section 5.4, 5.5). */
function producerLines(attempt, ctx, artifact) {
  const what = ctx.rerun ? 'what this step must fix: the findings it re-ran with, then the earlier attempts\' gate findings' : 'the earlier attempts\' gate findings'
  return reasonLines(attempt, ctx, artifact, what)
}

function d1Prompt(attempt, findings, ctx) {
  const lines = [
    `D1 for concept ${conceptId}: design both endgame variants of the build guide, the budget variant first (endgame first, D-104).`,
    '',
    `- The concept is the "### ${conceptId}: <title>" entry of dossier.md; its skeleton is concepts/${conceptId}/plan.json, with its compile record beside it.`,
    ctx.fresh
      ? `- Write plan.json whole, from this concept's skeleton: a plan.json already in the run folder belongs to an earlier design and is replaced.`
      : '- Edit plan.json (the header\'s writes): keep what the findings don\'t touch, and any campaign stage D2 wrote.',
    `- Validate with guide_run {validate: "${planPath}"}. Compile only measure-only: compile_plan {plan_path: "${planPath}", measure_only: true}, as often as you need, with stages naming a subset when you measure a line (two stages). Never a final compile.`,
    `- ${pricingLine('every filled slot and tree jewel of both variants (rares as affix-target searches)')}`,
    '- League: take it as your stage reference says; never from a skeleton or dossier line that marks it unverified, and never a guess such as Standard.',
  ]
  lines.push(...producerLines(attempt, ctx, 'plan.json\'s endgame stages, their ledger entries and prices'))
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

function d2Prompt(attempt, findings, ctx) {
  const lines = [
    `D2 for concept ${conceptId}: plan the campaign stages backward from the endgame variants in plan.json (D-104).`,
    '',
    '- Add the campaign stages to plan.json (the header\'s writes), before the endgame stages; leave the endgame stages as D1 wrote them.',
    `- Validate with guide_run {validate: "${planPath}"}. Compile only measure-only: compile_plan {plan_path: "${planPath}", measure_only: true}, with stages naming a subset when that is all you need. Never a final compile.`,
    `- ${pricingLine('the campaign uniques')}`,
  ]
  lines.push(...producerLines(attempt, ctx, 'plan.json\'s campaign stages, their ledger entries and prices'))
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
    '- Read the new record and return its V1 and V2 verdicts and its PoB file. Don\'t return the import code: compile-record.json is its one home (D-260). If the compile is refused or fails, report its error lines; never retry it or work around it.',
    '',
    closing,
  ]
  return header({ stage: 'D2-gate', attempt, compile: 'final', accepted: ACCEPTED, writes: [] }) + '\n' + lines.join('\n') + '\n'
}

function w1Prompt(attempt, findings, ctx) {
  const lines = [
    `W1 for concept ${conceptId}: write guide.md from plan.json, the final compile-record.json (its ledger values included), dossier.md and the guide template (${TEMPLATE}).`,
    '',
    '- Write only guide.md (the header\'s writes), and no other file; fix it in place with Edit (D-257). Copy the import code from compile-record.json\'s importCode into the guide exactly, and don\'t return it (D-260).',
  ]
  lines.push(
    leagueUnverified
      ? '- The league couldn\'t be verified (trade was unreachable when D1 ran; plan.json\'s league is "unverified"): say so in "Versions, prices and import code".'
      : '- Take the league from plan.json: "unverified" there means trade was unreachable when the endgame was priced, and the guide says so in "Versions, prices and import code".',
  )
  if (ACCEPTED.length > 0) lines.push('- The header\'s accepted lists findings the user accepted: the guide states each under "Accepted failures", as the stage reference says.')
  lines.push(...reasonLines(attempt, ctx, 'guide.md', ctx.rerun ? 'what this step must fix: the findings it re-ran with, then the earlier attempts\' findings' : 'the earlier attempts\' findings'))
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
  if (attempt > 1) lines.push(`- Attempt ${attempt}: an earlier attempt of this pass returned no report, or a report the workflow couldn't take; the header's findings say why.`)
  if (ACCEPTED_REPORT_IDS.length > 0) {
    lines.push("- The header's accepted lists V3 and V4 findings the user accepted, by id and location: report the same issue at the same location under the same id.")
  }
  lines.push('', "Follow your stage reference (the header's \"reference\") and end with the report it names.")
  return (
    header({ stage: job.stage, attempt, lens: job.lens, pass, compile: 'none', findings, accepted: ACCEPTED_REPORT_IDS, writes: [] }) + '\n' + lines.join('\n') + '\n'
  )
}

function dossierFixPrompt(attempt, findings, ctx) {
  const lines = [
    `dossier-fix for concept ${conceptId}: fix the claims of dossier.md the header's findings name (slice 03 section 5.5).`,
    '',
    '- Edit only dossier.md (the header\'s writes): no plan, no guide, no compile and no price call.',
  ]
  lines.push(...reasonLines(attempt, ctx, 'dossier.md', 'what this step must fix: the findings it re-ran with, then why the earlier attempts failed'))
  lines.push('', closing)
  return header({ stage: 'dossier-fix', attempt, compile: 'none', findings, accepted: ACCEPTED, writes: ['dossier.md'] }) + '\n' + lines.join('\n') + '\n'
}

function reviseMapPrompt(attempt, findings, guided) {
  const lines = [
    `revise-map for concept ${conceptId}: the user asked for changes at checkpoint 2. Map each request (the header's findings with code "user-request", each with its id) to the step that owns what it changes (slice 03 section 5.5): W1 for guide.md, D1 for an endgame stage, its ledger entries or its prices, D2 for a campaign stage, dossier-fix for dossier.md.`,
    '',
    '- Read the artifacts as you need them. Write nothing, compile nothing, price nothing: the owners make the changes after you.',
    `- Every request id (${REQUESTS.map((q) => q.id).join(', ')}) gets at least one entry; one that needs two owners gets one entry for each.`,
  ]
  const retry = retryLine(attempt, 'the requests, then why the earlier attempts\' mappings couldn\'t be used')
  if (retry) lines.push(retry)
  if (guided) lines.push(GUIDED_LINE)
  lines.push('', closing)
  return header({ stage: 'revise-map', attempt, compile: 'none', findings, writes: [] }) + '\n' + lines.join('\n') + '\n'
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
  // into this attempt's verdict as finalCompile, and its failure is this attempt's failure. finalCompile carries
  // no import code: compile-record.json is its one home, and a 10K-character code would swell the result the
  // skill copies into reports/ (D-260).
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

// ---- A design phase: the producer (D1 or D2), then its fresh gate (section 5.3, 5.4, 5.5) --------------

/**
 * Runs a producer and its gate until the gate passes, or the retries run out. `how` is:
 * - "normal": a first run, then up to the stage's retries left (D-127);
 * - "routed": the producer re-runs with V3/V4 findings on its claims, which spends one of its retries
 *   (section 5.5), then retries as usual;
 * - "revision": the producer re-runs with the user's checkpoint-2 requests, outside the cap (D-236), then
 *   retries as usual;
 * - "regate": the gate alone, fresh, because an earlier owner re-ran (section 5.5's regenerations, no
 *   retry), then retries as usual;
 * - "guided": one producer run outside the cap with the user's guidance, and no retry (D-236);
 * - "accepted": the gate alone, once more, outside the cap, with the findings the user accepted.
 * `upstream` names the owners that re-ran earlier in the same round (D1, for D2): their changes come first.
 * A producer that returns nothing re-runs; a gate that returns nothing re-runs on its own; a failing verdict
 * re-runs the producer with its findings, and the fresh gate after it is no retry of the gate.
 */
async function designPhase(producer, how, firstFindings, upstream = []) {
  const gate = GATE_OF[producer]
  const runProducer = producer === 'D1' ? runD1 : runD2
  const runGate = producer === 'D1' ? runD1Gate : runD2Gate
  // Every mode but a guided retry and an accepted resume retries under the cap (none outside it, D-236).
  const capped = how !== 'guided' && how !== 'accepted'
  const mayRetry = (stage) => capped && retriesLeft(stage) > 0
  const evidence = []
  const findings = firstFindings.slice()
  let claim = { claim: 'done', reason: null, attempt: null }
  let needProducer = how !== 'accepted' && how !== 'regate'
  let first = true
  // The producer writes the plan anew until one of its attempts in a fresh run has returned.
  let fresh = how === 'normal' && !attempts[producer]
  if (how === 'routed') spendRetry(producer)
  const escalated = (stage) => ({ status: 'escalated', stage, evidence })

  for (;;) {
    if (needProducer) {
      const attempt = nextAttempt(producer)
      const ctx = {
        fresh,
        guided: first && how === 'guided',
        why: first && (how === 'routed' || how === 'revision') ? how : null,
        rerun: how === 'routed' || how === 'revision',
        upstream,
      }
      first = false
      const res = await runProducer(attempt, findings.slice(), ctx)
      if (res === null) {
        const f = nullFinding(producer, attempt)
        attemptEntry(producer, attempt, 'null-result', 1)
        evidence.push({ gate: producer, attempt, ...f })
        findings.push({ attempt, ...f })
        if (!mayRetry(producer)) return escalated(producer)
        spendRetry(producer)
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
      if (!mayRetry(gate)) return escalated(gate)
      spendRetry(gate)
    }

    if (g.forced) {
      // FI-3 (section 11.3): control flow only, back to checkpoint 1.
      g.entry.outcome = 'infeasible'
      return { status: 'infeasible', stage: gate, evidence: [{ gate, attempt: g.attempt, code: 'FI-3', message: 'FI-3 (injected)' }] }
    }
    if (g.open.length === 0) return { status: 'pass' }

    evidence.push(...evidenceOf(gate, g.attempt, g.open))
    const hard = g.open.some((f) => HARD_PARTS.includes(f.part))
    const claimed = claim.claim === 'infeasible' && claim.reason !== null
      ? [{ gate: producer, attempt: claim.attempt, code: 'claimed-infeasible', message: claim.reason }]
      : []
    // Section 5.3's table: only floor, budget or rolledSkill failing, with D1 claiming infeasible, is
    // infeasible at once (D-141), with the verdict as evidence.
    if (!hard && claim.claim === 'infeasible') {
      g.entry.outcome = 'infeasible'
      return { status: 'infeasible', stage: gate, evidence: [...evidenceOf(gate, g.attempt, g.open), ...claimed] }
    }
    if (!mayRetry(producer)) {
      // Out of retries: a compile, V1 or V2 failure escalates; a floor, budget or rolled-skill failure is
      // infeasible. After a guided retry, any failure escalates again (D-236).
      if (hard || how === 'guided') {
        g.entry.outcome = 'escalated'
        return escalated(gate)
      }
      g.entry.outcome = 'infeasible'
      return { status: 'infeasible', stage: gate, evidence: evidenceOf(gate, g.attempt, g.open) }
    }
    spendRetry(producer)
    findings.push(...g.open.map((f) => ({ attempt: g.attempt, ...f })))
  }
}

async function runD1(attempt, findings, ctx) {
  const res = await run(COORDINATOR, d1Prompt(attempt, findings, ctx), {
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

async function runD2(attempt, findings, ctx) {
  const res = await run(COORDINATOR, d2Prompt(attempt, findings, ctx), {
    label: `D2 ${conceptId} attempt ${attempt}`,
    phase: 'D2 campaign',
    schema: D2_SCHEMA,
  })
  if (res !== null) notePriceCalls('D2', res)
  return res
}

// ---- Steps that write one file: W1 and dossier-fix ---------------------------------------------------

/**
 * Runs a step that writes one file and has no gate (W1, dossier-fix) until it returns. `how` is "normal" (a
 * first run), "routed" (spends one of its retries, section 5.5), "revision" (outside the cap, D-236), "regen"
 * (W1 only: an earlier owner re-ran, so the guide is written again, no retry), "guided" or "accepted" (one
 * run outside the cap, no retry). A run that returns nothing re-runs, as a retry, while retries are left.
 * The evidence of an escalation carries the findings it ran with, so a guided retry can send them again.
 */
async function writeStep(stage, how, firstFindings, upstream) {
  const findings = firstFindings.slice()
  const evidence = ['routed', 'revision', 'guided'].includes(how)
    ? firstFindings.filter((f) => f.code !== 'user-guidance').map((f) => ({ ...f, gate: isText(f.gate) ? f.gate : stage }))
    : []
  const capped = how !== 'guided' && how !== 'accepted'
  if (how === 'routed') spendRetry(stage)
  for (let first = true; ; first = false) {
    const attempt = nextAttempt(stage)
    const ctx = {
      guided: first && how === 'guided',
      why: first && ['routed', 'revision', 'regen'].includes(how) ? how : null,
      rerun: how === 'routed' || how === 'revision',
      upstream,
    }
    const res =
      stage === 'W1'
        ? await run(WRITER, w1Prompt(attempt, findings.slice(), ctx), { label: `W1 ${conceptId} attempt ${attempt}`, phase: 'W1 guide', schema: W1_SCHEMA })
        : await run(COORDINATOR, dossierFixPrompt(attempt, findings.slice(), ctx), {
          label: `dossier-fix ${conceptId} attempt ${attempt}`,
          phase: 'Dossier fix',
          schema: DOSSIER_FIX_SCHEMA,
        })
    if (res !== null) {
      attemptEntry(stage, attempt, 'done', 0)
      if (stage === 'W1') for (const gap of Array.isArray(res.gaps) ? res.gaps.filter(isText) : []) log(`W1: ${gap}`)
      if (stage === 'dossier-fix') {
        for (const nf of Array.isArray(res.notFixed) ? res.notFixed.filter(isObj) : []) log(`dossier-fix: not fixed ${nf.id}: ${nf.why}`)
      }
      return { status: 'pass' }
    }
    attemptEntry(stage, attempt, 'null-result', 1)
    const f = nullFinding(stage, attempt)
    evidence.push({ gate: stage, attempt, ...f })
    findings.push({ attempt, ...f })
    if (!capped || retriesLeft(stage) === 0) return { status: 'escalated', stage, evidence }
    spendRetry(stage)
  }
}

// ---- V3 and V4 (section 5.3 steps 6 and 7, section 7.4) ------------------------------------------------

/**
 * What keeps a returned report from being used (section 7.4): it answers another job, misses a field, says
 * `verdict` against its findings, marks a finding accepted-offline that isn't the sources lens's on a claim
 * tagged external-unavailable in an offline run (C-30), or counts
 * less than D-179 asks (every ledger entry re-derived, every data claim checked, every endgame pob-data claim
 * and at least 1 in 5 elsewhere re-checked, every external source opened, and none opened offline). Each
 * problem names fields and counts only, never a claim's text (R-5).
 */
function reportProblems(job, pass, r) {
  const out = []
  const want = { stage: job.stage, ...(job.lens ? { lens: job.lens } : {}), concept: conceptId, pass, mode }
  for (const [k, v] of Object.entries(want)) {
    if (r[k] !== v) out.push(`${k} is ${JSON.stringify(r[k] ?? null)}; this attempt's header says ${JSON.stringify(v)}`)
  }
  const findings = Array.isArray(r.findings) ? r.findings : null
  if (findings === null) out.push('findings is a list (section 7.4)')
  let unresolved = 0
  const ids = new Set()
  ;(findings || []).forEach((f, i) => {
    if (!isObj(f)) return out.push(`findings[${i}] is an object`)
    for (const k of FINDING_FIELDS) if (typeof f[k] !== 'string') out.push(`findings[${i}] has no ${k} (section 7.4)`)
    if (typeof f.owner === 'string' && !OWNERS.includes(f.owner)) out.push(`findings[${i}].owner is "${f.owner}"; one of ${OWNERS.join(', ')} (section 5.5)`)
    if (typeof f.status === 'string' && !FINDING_STATUSES.includes(f.status)) out.push(`findings[${i}].status is "${f.status}"; "unresolved" or "accepted-offline"`)
    if (f.status === 'accepted-offline' && mode !== 'offline') {
      out.push(`findings[${i}] is accepted-offline in an online run: only an offline run accepts an external-unavailable claim; report it unresolved (C-30)`)
    } else if (f.status === 'accepted-offline') {
      // C-30, section 7.4: accepted-offline is only the sources lens's word on a claim tagged external-unavailable.
      if (job.lens !== 'sources') out.push(`findings[${i}] is accepted-offline in a ${job.lens ? `${job.lens} lens` : 'V3'} report: only the sources lens marks a finding accepted-offline (C-30); report it unresolved`)
      else if (typeof f.issue !== 'string' || !f.issue.includes('external-unavailable') || typeof f.location !== 'string' || !CLAIM_LOCATION.test(f.location)) {
        out.push(`findings[${i}] is accepted-offline, but only a claim tagged external-unavailable is (C-30): its issue is "tagged external-unavailable" and its location the claim's (stages[<i>].claims[<k>] or <file> [^<id>]); report anything else unresolved`)
      }
    }
    if (typeof f.id === 'string') {
      if (ids.has(f.id)) out.push(`findings[${i}].id "${f.id}" is used twice; each finding has its own id`)
      ids.add(f.id)
    }
    if (f.status === 'unresolved') unresolved += 1
  })
  const verdict = unresolved > 0 ? 'fail' : 'pass'
  if (r.verdict !== verdict) out.push(`verdict is ${JSON.stringify(r.verdict ?? null)}; with ${unresolved} unresolved finding(s) it is "${verdict}" (section 7.4)`)
  const cov = r.coverage
  if (!isObj(cov)) out.push('coverage is an object (section 7.4)')
  else {
    const missing = COVERAGE[job.lens || job.stage].filter((k) => !(Number.isInteger(cov[k]) && cov[k] >= 0))
    for (const k of missing) out.push(`coverage.${k} is a count (section 7.4)`)
    if (missing.length === 0 && job.lens === 'ledger' && cov.rederived !== cov.entries) {
      out.push(`coverage.rederived is ${cov.rederived} of ${cov.entries} ledger entries; re-derive every one (D-179)`)
    }
    if (missing.length === 0 && job.lens === 'sources') {
      if (mode === 'online' && cov.opened !== cov.external) out.push(`coverage.opened is ${cov.opened} of ${cov.external} external claims; open the source of every one (D-179)`)
      if (mode === 'offline' && cov.opened !== 0) out.push(`coverage.opened is ${cov.opened} in an offline run; open no source offline (D-201)`)
      if (cov.dataChecked !== cov.data) out.push(`coverage.dataChecked is ${cov.dataChecked} of ${cov.data} data claims; check every one against its fact and citation (D-232)`)
      if (cov.recheckedEndgame < cov.pobDataEndgame) out.push(`coverage.recheckedEndgame is ${cov.recheckedEndgame} of ${cov.pobDataEndgame} endgame pob-data claims; re-check all of them (D-179)`)
      const least = Math.ceil(cov.pobDataOther / 5)
      if (cov.recheckedOther < least) out.push(`coverage.recheckedOther is ${cov.recheckedOther} of ${cov.pobDataOther} pob-data claims elsewhere; re-check at least ${least}, 1 in 5 (D-179)`)
      if (cov.matched > cov.prices) out.push(`coverage.matched is ${cov.matched}, above the ${cov.prices} price claims`)
    }
  }
  return out
}

/** The findings of a report that stand: unresolved, and not accepted by the user at an escalation (section 5.4). */
const openFindings = (job, r) => (Array.isArray(r.findings) ? r.findings.filter(isObj) : []).filter((f) => f.status === 'unresolved' && !coveredReport(f, job.stage))

/**
 * One verification pass: V3 and the three lenses, at most 3 in flight (D-161). One that returns nothing, or a
 * report that can't be used (`reportProblems`), re-runs with the reasons in its header's findings, together
 * with the others that need it; each such re-run spends a retry of its stage (V3, or V4 for the lenses). A
 * guided pass (`single`) gives each one try.
 */
async function verifyPass(pass, single) {
  const jobs = [{ stage: 'V3' }, ...LENSES.map((lens) => ({ stage: 'V4', lens }))]
  const reports = jobs.map(() => null)
  const notes = jobs.map(() => [])
  let pending = jobs.map((_, i) => i)
  for (let attempt = 1; pending.length > 0; attempt += 1) {
    const batch = pending
    const results = await limited(
      batch.map((i) => () => {
        const job = jobs[i]
        return run(job.stage === 'V3' ? PROVENANCE : VERIFIER, verifyPrompt(job, pass, attempt, notes[i].slice()), {
          label: `${job.stage}${job.lens ? ` ${job.lens}` : ''} ${conceptId} pass ${pass} attempt ${attempt}`,
          phase: 'V3 and V4',
          schema: reportSchema(job),
        })
      }),
      FAN_OUT,
    )
    pending = []
    results.forEach((r, k) => {
      const i = batch[k]
      const job = jobs[i]
      const extra = { ...(job.lens ? { lens: job.lens } : {}), pass }
      if (r === null) {
        attemptEntry(job.stage, attempt, 'null-result', 1, 1, extra)
        notes[i].push({ attempt, ...nullFinding(job.stage, attempt) })
        pending.push(i)
        return
      }
      // Every report returned goes to reports/ (FR-W6); a later attempt of the same pass replaces its file.
      ;(job.stage === 'V3' ? v3Reports : v4Reports).push(r)
      const problems = reportProblems(job, pass, r)
      if (problems.length > 0) {
        attemptEntry(job.stage, attempt, 'fail', problems.length, 1, extra)
        notes[i].push(...problems.map((message) => ({ attempt, code: 'unusable-report', message })))
        pending.push(i)
        return
      }
      attemptEntry(job.stage, attempt, openFindings(job, r).length === 0 ? 'pass' : 'fail', r.findings.length, 1, extra)
      reports[i] = r
    })
    if (single) break
    pending = pending.filter((i) => retriesLeft(jobs[i].stage) > 0)
    for (const stage of [...new Set(pending.map((i) => jobs[i].stage))]) spendRetry(stage)
  }
  return { jobs, reports, notes }
}

/** A pass's outcome: "ready", "open" with its unresolved findings, or "escalated" when a verifier never reported. */
async function verify(pass, single) {
  const { jobs, reports, notes } = await verifyPass(pass, single)
  const dead = jobs.map((j, i) => [j, i]).filter(([, i]) => reports[i] === null)
  if (dead.length > 0) {
    return {
      status: 'escalated',
      stage: dead[0][0].stage,
      evidence: dead.flatMap(([j, i]) => notes[i].map((n) => ({ gate: j.stage, ...(j.lens ? { lens: j.lens } : {}), pass, ...n }))),
    }
  }
  const unresolved = []
  reports.forEach((r, i) => {
    for (const f of openFindings(jobs[i], r)) unresolved.push({ gate: jobs[i].stage, ...(jobs[i].lens ? { lens: jobs[i].lens } : {}), pass, ...f })
  })
  return unresolved.length > 0 ? { status: 'open', unresolved } : { status: 'ready' }
}

/** Findings grouped by their owner (section 5.5), and the owners in run order. */
function byOwner(findings) {
  const groups = {}
  for (const f of findings) {
    if (!OWNERS.includes(f.owner)) continue
    if (!groups[f.owner]) groups[f.owner] = []
    groups[f.owner].push(f)
  }
  return { groups, owners: OWNERS.filter((o) => groups[o]) }
}

/**
 * Re-runs the owners, earliest first, each with its own findings, and the steps section 5.5 lists after
 * each: dossier-fix alone; D1, then the D1 gate, the D2 gate and the final compile, and W1; D2, then the D2
 * gate and the final compile, and W1; W1. `how` is the owners' mode ("routed", "revision" or "guided"); the
 * steps regenerated after them are no retries. V3 and V4 follow, from the caller.
 */
async function regenerate(owners, groups, how) {
  const has = (o) => owners.includes(o)
  if (has('dossier-fix')) {
    phase('Dossier fix')
    const r = await writeStep('dossier-fix', how, groups['dossier-fix'], [])
    if (r.status !== 'pass') return r
  }
  if (has('D1')) {
    phase('D1 endgame')
    const r = await designPhase('D1', how, groups.D1)
    if (r.status !== 'pass') return r
  }
  if (has('D1') || has('D2')) {
    phase('D2 campaign')
    const r = await designPhase('D2', has('D2') ? how : 'regate', has('D2') ? groups.D2 : [], has('D1') ? ['D1'] : [])
    if (r.status !== 'pass') return r
  }
  if (has('D1') || has('D2') || has('W1')) {
    phase('W1 guide')
    const upstream = owners.filter((o) => o === 'D1' || o === 'D2')
    const r = await writeStep('W1', has('W1') ? how : 'regen', has('W1') ? groups.W1 : [], upstream)
    if (r.status !== 'pass') return r
  }
  return { status: 'pass' }
}

/**
 * V3 and V4, then section 5.5's routing: while a pass has unresolved findings, each owner re-runs once with all
 * its findings (one retry of that owner), then the steps after it, then V3 and the three lenses again, as the
 * next pass. An owner with no retry left (a third round, D-127) ends the flow escalated, with the pass's
 * findings as evidence. Findings marked accepted-offline, and those the user accepted, aren't routed. A
 * guided pass (`guided`) routes nothing: a failure escalates again (D-236).
 */
async function verifyAndRoute(firstPass, guided) {
  for (let pass = firstPass; ; pass += 1) {
    phase('V3 and V4')
    const v = await verify(pass, guided)
    if (v.status !== 'open') return v
    const stage = v.unresolved[0].gate
    const { groups, owners } = byOwner(v.unresolved)
    const spentOwners = owners.filter((o) => retriesLeft(o) === 0)
    if (guided || owners.length === 0 || spentOwners.length > 0) {
      const why = guided ? 'a guided retry routes none' : owners.length === 0 ? 'no finding names an owner' : `${spentOwners.join(', ')} has no retry left (D-127)`
      log(`pass ${pass}: ${v.unresolved.length} unresolved finding(s); ${why}: escalated`)
      return { status: 'escalated', stage, evidence: v.unresolved }
    }
    log(`pass ${pass}: ${v.unresolved.length} unresolved finding(s); re-running ${owners.join(', ')} (section 5.5)`)
    const r = await regenerate(owners, groups, 'routed')
    if (r.status !== 'pass') return r
  }
}

// ---- The checkpoint-2 revision (section 5.3 "Resuming"; D-236) ----------------------------------------

/** The revise-map step's mapping, checked against the requests: every id mapped, each entry a known id and owner. */
function checkMapping(res) {
  const problems = []
  const mapping = []
  for (const [i, e] of (Array.isArray(res.mapping) ? res.mapping : []).entries()) {
    if (!isObj(e) || !REQUESTS.some((q) => q.id === e.id)) {
      problems.push(`mapping[${i}] names no request id (${REQUESTS.map((q) => q.id).join(', ')})`)
      continue
    }
    if (!OWNERS.includes(e.owner)) {
      problems.push(`mapping[${i}] (${e.id}) names owner ${JSON.stringify(e.owner ?? null)}; one of ${OWNERS.join(', ')}`)
      continue
    }
    if (!mapping.some((m) => m.id === e.id && m.owner === e.owner)) mapping.push({ id: e.id, owner: e.owner })
  }
  for (const q of REQUESTS) if (!mapping.some((m) => m.id === q.id)) problems.push(`request ${q.id} has no owner`)
  mapping.sort((a, b) => REQUESTS.findIndex((q) => q.id === a.id) - REQUESTS.findIndex((q) => q.id === b.id) || OWNERS.indexOf(a.owner) - OWNERS.indexOf(b.owner))
  return { mapping, problems }
}

/**
 * A revision: one revise-map coordinator step maps each request to its owner (section 5.5's table); every
 * owner re-runs once with only its own requests as findings, earliest first, outside the cap, followed by the
 * steps section 5.5 lists after it; then V3 and V4, routed as usual. A gate failure after it gets the usual 2
 * retries. `guided` is a guided retry of an escalated revise-map: it runs once more with the user's guidance,
 * outside the cap.
 */
async function revision(guided) {
  phase('Revision')
  const requests = REQUESTS.map((q) => ({ id: q.id, code: 'user-request', message: q.text }))
  const notes = guided ? withGate(resume.findings, 'revise-map').filter((f) => f.code !== 'user-request') : []
  const evidence = []
  let mapping = null
  for (let first = true; mapping === null; first = false) {
    const attempt = nextAttempt('revise-map')
    const findings = [...requests, ...notes, ...(guided && first ? [{ code: 'user-guidance', message: resume.guidance.trim() }] : [])]
    const res = await run(COORDINATOR, reviseMapPrompt(attempt, findings, guided && first), {
      label: `revise-map ${conceptId} attempt ${attempt}`,
      phase: 'Revision',
      schema: REVISE_MAP_SCHEMA,
    })
    let problems
    if (res === null) {
      attemptEntry('revise-map', attempt, 'null-result', 1)
      problems = [nullFinding('revise-map', attempt)]
    } else {
      const checked = checkMapping(res)
      attemptEntry('revise-map', attempt, checked.problems.length === 0 ? 'done' : 'fail', checked.problems.length)
      if (checked.problems.length === 0) mapping = checked.mapping
      problems = checked.problems.map((message) => ({ code: 'unusable-mapping', message }))
    }
    if (mapping !== null) break
    for (const p of problems) {
      notes.push({ attempt, ...p })
      evidence.push({ gate: 'revise-map', attempt, ...p })
    }
    if (guided || retriesLeft('revise-map') === 0) {
      // The revision's requests, none mapped: the skill still records the revision in revisions[] (D-236).
      stats.revision = REQUESTS.map((q) => ({ request: q.text, owner: null }))
      return { status: 'escalated', stage: 'revise-map', evidence }
    }
    spendRetry('revise-map')
  }

  stats.revision = mapping.map((m) => ({ request: REQUESTS.find((q) => q.id === m.id).text, owner: m.owner }))
  const groups = {}
  for (const m of mapping) {
    if (!groups[m.owner]) groups[m.owner] = []
    groups[m.owner].push(requests.find((q) => q.id === m.id))
  }
  const owners = OWNERS.filter((o) => groups[o])
  log(`revision round ${ROUND}: ${REQUESTS.length} request(s) mapped to ${owners.join(', ')}`)
  const r = await regenerate(owners, groups, 'revision')
  if (r.status !== 'pass') return r
  return verifyAndRoute(firstPass, false)
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
  stats.retries = spentHere.map(([stage, count]) => ({ stage, concept: conceptId, ...(ROUND !== null ? { round: ROUND } : {}), count }))
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

const ended = (r) => (r.status === 'ready' ? finish('ready') : finish(r.status, { stage: r.stage, evidence: r.evidence }))

// Where the flow starts: at D1, or where a resume puts it (section 5.3 "Resuming").
const from = !resume ? 'D1' : resume.reason === 'revision' ? null : gateFor(resume.stage)
const guidance = resume && resume.reason === 'guided-retry'
  ? [...withGate(resume.findings, from), { code: 'user-guidance', message: resume.guidance.trim() }]
  : []
// Accepting a V3/V4 escalation regenerates the guide, so W1 states the accepted findings under "Accepted
// failures", then V3 and V4 check it with those findings covered by id (D-253).
const startAt = { D1: 0, 'D1-gate': 0, 'D2-gate': 1, W1: 2, V3: 2, V4: 2 }[from]
const howAt = (step) => (resume && step === startAt ? (resume.reason === 'guided-retry' ? 'guided' : 'accepted') : 'normal')
const firstFindingsAt = (step) => (resume && step === startAt && resume.reason === 'guided-retry' ? guidance : [])
const firstPass = 1 + Math.max(made.V3 ?? 0, made.V4 ?? 0)

need(!(resume && resume.reason === 'accepted' && from === 'W1'), 'args.resume {reason: "accepted", stage: "W1"}: W1 escalates only when it returns nothing, so there is no guide to accept')
need(!(resume && resume.reason === 'accepted' && from === 'dossier-fix'), 'args.resume {reason: "accepted", stage: "dossier-fix"}: dossier-fix escalates only when it returns nothing, so there is no fix to accept')
need(!(resume && resume.reason === 'accepted' && from === 'revise-map'), 'args.resume {reason: "accepted", stage: "revise-map"}: an escalated revise-map mapped nothing, so there is nothing to accept; a guided retry or checkpoint 2 asks again')

/** The flow from D1, or from where an escalation's resume puts it, through V3 and V4. */
async function designAndVerify() {
  if (startAt <= 0) {
    phase('D1 endgame')
    const d1 = await designPhase('D1', howAt(0), firstFindingsAt(0))
    if (d1.status !== 'pass') return d1
  }
  if (startAt <= 1) {
    phase('D2 campaign')
    const d2 = await designPhase('D2', howAt(1), firstFindingsAt(1))
    if (d2.status !== 'pass') return d2
  }
  if (startAt <= 2) {
    phase('W1 guide')
    const w1 = await writeStep('W1', howAt(2), firstFindingsAt(2), [])
    if (w1.status !== 'pass') return w1
  }
  return verifyAndRoute(firstPass, false)
}

/**
 * A guided retry of an escalated V3 or V4 (D-236): the findings' owners re-run once with their findings and
 * the user's guidance, outside the cap, with the steps after them; then one more pass of V3 and V4, whose
 * failure escalates again. With no owner (a verifier that never reported), the pass alone runs again.
 */
async function guidedVerify() {
  const own = withGate(resume.findings, from).filter((f) => OWNERS.includes(f.owner))
  const { groups, owners } = byOwner(own)
  for (const o of owners) groups[o].push({ code: 'user-guidance', message: resume.guidance.trim() })
  if (owners.length > 0) {
    const r = await regenerate(owners, groups, 'guided')
    if (r.status !== 'pass') return r
  }
  return verifyAndRoute(firstPass, true)
}

/** A guided retry of an escalated dossier-fix: it runs once more with its findings and the guidance, then V3 and V4. */
async function guidedDossierFix() {
  phase('Dossier fix')
  const r = await writeStep('dossier-fix', 'guided', guidance, [])
  if (r.status !== 'pass') return r
  return verifyAndRoute(firstPass, false)
}

let outcome
if (resume && resume.reason === 'revision') outcome = await revision(false)
else if (resume && from === 'revise-map') outcome = await revision(true)
else if (resume && resume.reason === 'guided-retry' && (from === 'V3' || from === 'V4')) outcome = await guidedVerify()
else if (resume && from === 'dossier-fix') outcome = await guidedDossierFix()
else outcome = await designAndVerify()
return ended(outcome)
