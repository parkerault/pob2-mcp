export const meta = {
  name: 'build-guide-research',
  description: 'One research round of a build-guide run (R1): three lookup-only researchers in parallel, then one coordinator step at a time compiles each carried concept skeleton measure-only and prices its key items, then the dossier is assembled',
  whenToUse: 'Only from the build-guide skill (.claude/skills/build-guide/SKILL.md) or its fallback, once per research round, with args {runFolder, runFolderRel, roll, mode, pass, firstId, note?, faults?}',
  phases: [
    { title: 'R1a research', detail: 'three build-guide-researcher agents in parallel, one research file each' },
    { title: 'R1b skeletons', detail: 'one build-guide-coordinator step per carried concept, in id order, up to 2 retries each' },
    { title: 'R1b assembly', detail: 'one build-guide-coordinator step writes dossier.md' },
  ],
}

// The research workflow of the build-guide pipeline: docs/build-guide/spec/03-pipeline.md section 5.2.
// A saved workflow is plain JavaScript run by the Workflow tool: no filesystem, no clock, no randomness
// (docs/design/grounding/2026-10-07-claude-code-platform.md section 5).
//
// Returns {status, concepts, gateVerdicts, stats, round, dossier}:
// - status: "ok" when a concept of this round is viable, else "no-viable";
// - concepts: [{id, title, status: "viable" | "failed" | "not-carried", attempts, evidence}];
// - gateVerdicts: one R1b verdict per attempt that returned a result (references/gates.md);
// - stats: {attempts, agents, retries, priceCalls, faults, revision} (references/run-log.md);
// - round: {round, firstId, note, concepts, conceptsCompiled}, for the run log's rounds[];
// - dossier: "dossier.md", or null when the assembly step never returned.

const STAGE_REFS = '.claude/skills/build-guide/references/stages/'
const RESEARCHER = 'build-guide-researcher'
const COORDINATOR = 'build-guide-coordinator'
const CONCEPTS_PER_ROUND = 3 // D-161, D-235: the cap is per research round
const RETRIES = 2 // D-127: at most 2 retries per (stage, concept)
const PRICING_STOPS = ['locked_out', 'rate_limited'] // section 9: pricing stops for the rest of the run
const FI1_GEM = 'FI-1 Unknown Gem'

// ---- Arguments ---------------------------------------------------------------------------------------

const isText = (v) => typeof v === 'string' && v.trim() !== ''
const input = args && typeof args === 'object' ? args : {}
const need = (ok, what) => {
  if (!ok) throw new Error(`build-guide-research: ${what}`)
}
need(isText(input.runFolder), 'args.runFolder (the run folder\'s absolute path, from guide_run {new_run}) is required')
need(isText(input.runFolderRel), 'args.runFolderRel (the run folder relative to the guides root) is required')
need(input.roll && isText(input.roll.ascendancy) && isText(input.roll.skill), 'args.roll is {className, ascendancy, skill}')
need(input.mode === 'offline' || input.mode === 'online', 'args.mode is "offline" or "online"')
need(Number.isInteger(input.pass) && input.pass >= 1, 'args.pass is the research round, from 1')
need(Number.isInteger(input.firstId) && input.firstId >= 1, 'args.firstId is the number of the first concept id this round assigns')

const { runFolder, runFolderRel, roll, mode, firstId } = input
const round = input.pass
const note = isText(input.note) ? input.note.trim() : null
const rollText = `${isText(roll.className) ? `${roll.className} ` : ''}${roll.ascendancy} with ${roll.skill}`

// Fault directives (section 11.3) come only from an accepted test config, so only in offline mode. This
// workflow applies FI-1 alone, and only in the R1b headers a directive targets.
const givenFaults = Array.isArray(input.faults) ? input.faults : []
if (mode !== 'offline' && givenFaults.length > 0) log('fault directives ignored: they apply only in offline test mode (section 11.2)')
const FAULTS = (mode === 'offline' ? givenFaults : [])
  .filter((d) => d && d.id === 'FI-1')
  .map((d) => ({
    id: 'FI-1',
    concepts: d.concepts === 'all' ? 'all' : Array.isArray(d.concepts) ? d.concepts.filter(isText) : [],
    persistent: d.persistent === true,
  }))
const faultTally = FAULTS.map(() => ({ targeted: 0, applied: 0, observed: null }))
const faultsFor = (concept, attempt) =>
  FAULTS.filter((d) => (d.concepts === 'all' || d.concepts.includes(concept)) && (d.persistent || attempt === 1))

// ---- The task header (section 5.1) and the agent runner -----------------------------------------------

function header(h) {
  const out = { stage: h.stage, attempt: h.attempt }
  if (h.concept !== undefined) out.concept = h.concept
  out.mode = mode
  out.runFolder = runFolder
  out.runFolderRel = runFolderRel
  out.compile = h.compile
  out.findings = h.findings || []
  out.accepted = []
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
    return result && typeof result === 'object' ? result : null
  } catch (e) {
    log(`${opts.label}: the agent failed (${e && e.message ? e.message : e}); counted as no result`)
    return null
  } finally {
    inFlight -= 1
  }
}

const nullFinding = (stage, attempt, concept) => ({
  code: 'null-result',
  message: `${stage} attempt ${attempt}${concept ? ` for ${concept}` : ''} returned no result: the agent died, was skipped or failed`,
})

// ---- Schemas of the steps' returns -------------------------------------------------------------------

const R1A_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    concepts: {
      type: 'array',
      items: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    },
  },
  required: ['file', 'concepts'],
}

const R1B_SCHEMA = {
  type: 'object',
  properties: {
    compiled: { type: 'boolean' },
    errors: { type: 'array', items: { type: 'string' } },
    recordPath: { type: ['string', 'null'] },
    numbers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { stage: { type: 'string' }, field: { type: 'string' }, value: { type: 'number' } },
        required: ['stage', 'field', 'value'],
      },
    },
    prices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          item: { type: 'string' },
          status: { type: 'string', enum: ['ok', 'unavailable'] },
          amount: { type: ['number', 'null'] },
          currency: { type: ['string', 'null'] },
          date: { type: 'string' },
          league: { type: ['string', 'null'] },
          note: { type: 'string' },
        },
        required: ['id', 'item', 'status', 'date'],
      },
    },
    priceCalls: {
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
    },
    faultsApplied: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, observed: { type: 'string' } }, required: ['id', 'observed'] },
    },
  },
  required: ['compiled', 'errors', 'numbers', 'prices', 'priceCalls'],
}

const ASSEMBLE_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    missingRecords: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'missingRecords'],
}

// ---- R1a: up to 3 researchers in parallel (D-161), one research file each -----------------------------

const FOCI = [
  {
    focus: 'mechanics',
    task: "the rolled skill's mechanics, the ascendancy's interactions with it, and the config gaps (sections Mechanics and Config gaps)",
    propose: 'Propose no concept: return "concepts": [].',
  },
  {
    focus: 'items',
    task: 'the synergy search through unique items and support gems (section Synergy search)',
    propose: 'Propose one or two concepts led by key items, each in its own "## Concept: <title>" section.',
  },
  {
    focus: 'tree',
    task: 'the synergy search through the ascendancy notables, keystones and the passive tree (section Synergy search)',
    propose: 'Propose one concept led by the ascendancy and the tree, in a "## Concept: <title>" section.',
  },
]
const researchFiles = FOCI.map((_, i) => `research/p${round}-r1a-${i + 1}.md`)

function researchPrompt(i) {
  const f = FOCI[i]
  const file = researchFiles[i]
  const lines = [
    `Research agent ${i + 1} of ${FOCI.length}, research round ${round}, for the build guide of ${rollText}.`,
    '',
    `- Focus "${f.focus}": ${f.task}.`,
    `- ${f.propose}`,
    `- Write only ${file} (the header's writes), inside the run folder.`,
    `- Source-marker ids in your file are p${round}r${i + 1}-<m> (m from 1), so they stay unique in the dossier.`,
  ]
  if (round > 1) lines.push("- This is a later research round: read dossier.md first, and propose only concepts it doesn't already hold.")
  if (note) lines.push(`- The user's note for this round: ${JSON.stringify(note)}`)
  lines.push('', `Follow your stage reference (the header's "reference") and end with the JSON it names: {"file": "${file}", "concepts": [{"title": "..."}]}.`)
  return header({ stage: 'R1a', attempt: 1, compile: 'none', writes: [file] }) + '\n' + lines.join('\n') + '\n'
}

phase('R1a research')
const research = await parallel(
  FOCI.map((f, i) => () => run(RESEARCHER, researchPrompt(i), { label: `R1a ${i + 1} (${f.focus})`, phase: 'R1a research', schema: R1A_SCHEMA })),
)

const proposals = []
const silentFiles = []
research.forEach((r, i) => {
  const file = researchFiles[i]
  if (r === null || typeof r !== 'object') {
    stats.attempts.push({ stage: 'R1a', attempt: 1, agents: 1, outcome: 'null-result', findings: 0 })
    silentFiles.push(file)
    log(`R1a ${i + 1}: no result; ${file} may be missing or partial`)
    return
  }
  stats.attempts.push({ stage: 'R1a', attempt: 1, agents: 1, outcome: 'done', findings: 0 })
  if (r.file !== file) log(`R1a ${i + 1} reported ${JSON.stringify(r.file)}; its file is ${file}`)
  for (const c of Array.isArray(r.concepts) ? r.concepts : []) {
    if (c && isText(c.title)) proposals.push({ title: c.title.trim(), file })
  }
})

// ---- Ids and the cap (D-235): ids in return order from c<firstId>; at most 3 carried this round --------

const concepts = proposals.map((p, i) => ({ id: `c${firstId + i}`, title: p.title, file: p.file }))
const carried = concepts.slice(0, CONCEPTS_PER_ROUND)
const notCarried = concepts.slice(CONCEPTS_PER_ROUND)
for (const c of notCarried) {
  log(`${c.id} "${c.title}" (${c.file}) not carried: round ${round} already carries ${CONCEPTS_PER_ROUND} concepts (D-235)`)
}

// ---- R1b: one coordinator step at a time; gate: compiled with no compile error (C-36) ----------------

const gateVerdicts = []
const outcomes = new Map()
let pricingStopped = null

// A gate finding (references/gates.md): part, a stable code, the plan stage when the error names one.
function compileFinding(message) {
  const m = /^stage ([A-Za-z0-9]+): /.exec(message)
  return { part: 'compiled', code: 'compile-error', ...(m ? { stage: m[1] } : {}), message }
}

function pricingLine() {
  if (mode === 'offline') {
    return 'Offline run: make no price call; record each key item as unavailable with note "offline run" and league null (.claude/skills/build-guide/references/pricing.md).'
  }
  if (pricingStopped) {
    return `Pricing has stopped for this run (a price call came back ${pricingStopped}): make no price call; every key item is unavailable.`
  }
  return 'Price the concept\'s key items at the pace .claude/skills/build-guide/references/pricing.md sets, and report every price-tool call in priceCalls.'
}

function skeletonPrompt(c, attempt, findings, faults) {
  const plan = `concepts/${c.id}/plan.json`
  const lines = [
    `R1b for concept ${c.id}, "${c.title}", proposed in ${c.file} (research round ${round}), for the build guide of ${rollText}.`,
    '',
    `- Write the concept's endgame skeleton at ${plan}, check it with guide_run {validate: "${runFolderRel}/${plan}"}, and compile it with compile_plan {plan_path: "${runFolderRel}/${plan}", measure_only: true}. Never a final compile.`,
    `- ${pricingLine()}`,
  ]
  if (attempt > 1) lines.push(`- Attempt ${attempt}: the header's findings are the earlier attempts' gate findings; fix what they name.`)
  if (faults.length > 0) lines.push('- Fault directive FI-1 applies to this attempt: apply it right before the compile, as the stage reference says, and never work around it.')
  lines.push('', "Follow your stage reference (the header's \"reference\") and end with the JSON it names.")
  return header({ stage: 'R1b', attempt, concept: c.id, compile: 'measure-only', findings, faults, writes: [plan] }) + '\n' + lines.join('\n') + '\n'
}

phase('R1b skeletons')
for (const c of carried) {
  const earlier = []
  let lastErrors = [] // the last compile errors any attempt reported: a failed concept's evidence
  let outcome = { status: 'failed', attempts: 0, evidence: [], recordPath: null, numbers: [], prices: [] }
  for (let attempt = 1; attempt <= 1 + RETRIES; attempt += 1) {
    const faults = faultsFor(c.id, attempt)
    for (const d of faults) faultTally[FAULTS.indexOf(d)].targeted += 1
    const res = await run(COORDINATOR, skeletonPrompt(c, attempt, earlier.slice(), faults), {
      label: `R1b ${c.id} attempt ${attempt}`,
      phase: 'R1b skeletons',
      schema: R1B_SCHEMA,
    })
    outcome.attempts = attempt

    if (res === null) {
      // A null result is a failed attempt; it has no verdict, so no gate file (references/run-log.md).
      const f = { part: 'compiled', ...nullFinding('R1b', attempt, c.id) }
      stats.attempts.push({ stage: 'R1b', concept: c.id, attempt, agents: 1, outcome: 'null-result', findings: 1 })
      earlier.push({ attempt, ...f })
      outcome.evidence = [f.message, ...lastErrors]
      continue
    }

    const errors = (Array.isArray(res.errors) ? res.errors : []).filter(isText).map((e) => e.trim())
    const passed = res.compiled === true && errors.length === 0
    const findings = passed
      ? []
      : (errors.length > 0 ? errors : [`the step reported compiled: ${JSON.stringify(res.compiled)} with no error line`]).map(compileFinding)
    const recordPath = isText(res.recordPath) ? res.recordPath : null
    gateVerdicts.push({
      stage: 'R1b',
      concept: c.id,
      attempt,
      verdict: { compiled: passed ? 'pass' : 'fail' },
      findings,
      errors,
      recordPath,
    })
    stats.attempts.push({ stage: 'R1b', concept: c.id, attempt, agents: 1, outcome: passed ? 'pass' : 'fail', findings: findings.length })

    for (const call of Array.isArray(res.priceCalls) ? res.priceCalls : []) {
      if (!call || typeof call !== 'object') continue
      const entry = {
        at: isText(call.at) ? call.at : null,
        stage: 'R1b',
        tool: String(call.tool ?? ''),
        item: String(call.item ?? ''),
        outcome: isText(call.outcome) ? call.outcome : 'error',
      }
      stats.priceCalls.push(entry)
      if (mode === 'offline') log(`R1b ${c.id} attempt ${attempt} reported a price call in an offline run: ${entry.tool} ${entry.item}`)
      if (!pricingStopped && PRICING_STOPS.includes(entry.outcome)) pricingStopped = entry.outcome
    }

    // FI-1 counts as applied when the step reports it or a compile error names its gem.
    const reported = Array.isArray(res.faultsApplied) ? res.faultsApplied : []
    for (const d of faults) {
      const tally = faultTally[FAULTS.indexOf(d)]
      const said = reported.find((r) => r && r.id === d.id)
      const named = errors.find((e) => e.includes(FI1_GEM))
      if (said || named) {
        tally.applied += 1
        tally.observed = said && isText(said.observed) ? said.observed : named
      } else {
        log(`R1b ${c.id} attempt ${attempt}: FI-1 was in the header, but the step reported no application`)
      }
    }

    if (passed) {
      outcome = {
        status: 'viable',
        attempts: attempt,
        evidence: [],
        recordPath: recordPath || `concepts/${c.id}/compile-record.json`,
        numbers: Array.isArray(res.numbers) ? res.numbers : [],
        prices: Array.isArray(res.prices) ? res.prices : [],
      }
      break
    }
    lastErrors = findings.map((f) => f.message)
    outcome.evidence = lastErrors
    outcome.prices = Array.isArray(res.prices) ? res.prices : []
    earlier.push(...findings.map((f) => ({ attempt, ...f })))
  }
  if (outcome.attempts > 1) stats.retries.push({ stage: 'R1b', concept: c.id, count: outcome.attempts - 1 })
  if (outcome.status === 'failed') log(`${c.id} failed after ${outcome.attempts} attempts: ${outcome.evidence.join(' | ')}`)
  outcomes.set(c.id, outcome)
}

// ---- R1b assembly: one coordinator step writes dossier.md (section 7.2) -------------------------------

const notCarriedEvidence = (c) => `not carried: research round ${round} already carries ${CONCEPTS_PER_ROUND} concepts (D-235); proposed in ${c.file}`

const assemblyInput = {
  round,
  firstId,
  note,
  researchFiles: researchFiles.map((file) => ({ file, returned: !silentFiles.includes(file) })),
  concepts: concepts.map((c) => {
    const o = outcomes.get(c.id)
    if (!o) return { id: c.id, title: c.title, proposedIn: c.file, status: 'not-carried', evidence: [notCarriedEvidence(c)] }
    return {
      id: c.id,
      title: c.title,
      proposedIn: c.file,
      status: o.status,
      attempts: o.attempts,
      evidence: o.evidence,
      skeleton: `concepts/${c.id}/plan.json`,
      recordPath: o.recordPath,
      numbers: o.numbers,
      prices: o.prices,
    }
  }),
}

function assemblePrompt(attempt, findings) {
  const lines = [
    `Assemble the dossier for research round ${round} of the build guide of ${rollText}.`,
    '',
    round === 1
      ? '- Write dossier.md from the template, the research files and the R1b results below.'
      : '- dossier.md holds the earlier rounds: keep everything in it, and add this round as the stage reference says.',
    '- Confirm that every viable concept\'s compile record is beside its skeleton; list each one that isn\'t in "missingRecords" and mark it failed in the dossier.',
    '',
    'This round (research files, and every concept with its R1b result):',
    '',
    '```json',
    JSON.stringify(assemblyInput, null, 2),
    '```',
    '',
    "Follow your stage reference (the header's \"reference\") and end with the JSON it names.",
  ]
  return header({ stage: 'R1b-assemble', attempt, compile: 'none', findings, writes: ['dossier.md'] }) + '\n' + lines.join('\n') + '\n'
}

phase('R1b assembly')
let dossier = null
const assemblyFindings = []
let assemblyAttempts = 0
for (let attempt = 1; attempt <= 1 + RETRIES && dossier === null; attempt += 1) {
  assemblyAttempts = attempt
  const res = await run(COORDINATOR, assemblePrompt(attempt, assemblyFindings.slice()), {
    label: `R1b-assemble attempt ${attempt}`,
    phase: 'R1b assembly',
    schema: ASSEMBLE_SCHEMA,
  })
  if (res === null) {
    stats.attempts.push({ stage: 'R1b-assemble', attempt, agents: 1, outcome: 'null-result', findings: 1 })
    assemblyFindings.push({ attempt, ...nullFinding('R1b-assemble', attempt) })
    continue
  }
  stats.attempts.push({ stage: 'R1b-assemble', attempt, agents: 1, outcome: 'done', findings: 0 })
  dossier = 'dossier.md'
  for (const id of Array.isArray(res.missingRecords) ? res.missingRecords : []) {
    const o = outcomes.get(id)
    if (o && o.status === 'viable') {
      o.status = 'failed'
      o.evidence = [`R1b-assemble found no compile record beside concepts/${id}/plan.json (expected ${o.recordPath})`]
      log(`${id} marked failed: no compile record beside its skeleton`)
    }
  }
}
if (assemblyAttempts > 1) stats.retries.push({ stage: 'R1b-assemble', concept: null, count: assemblyAttempts - 1 })
if (dossier === null) log(`R1b-assemble returned no result in ${assemblyAttempts} attempts; dossier.md may be missing`)

// ---- Result ---------------------------------------------------------------------------------------------

stats.faults = FAULTS.flatMap((d, i) => {
  const t = faultTally[i]
  if (t.targeted === 0) return []
  return [{
    id: d.id,
    target: { concepts: d.concepts, persistent: d.persistent },
    applied: t.applied,
    observed: t.observed ?? `not applied: ${t.targeted} R1b header(s) carried it, and no step reported it`,
  }]
})

const resultConcepts = concepts.map((c) => {
  const o = outcomes.get(c.id)
  if (!o) return { id: c.id, title: c.title, status: 'not-carried', attempts: 0, evidence: [notCarriedEvidence(c)] }
  return { id: c.id, title: c.title, status: o.status, attempts: o.attempts, evidence: o.evidence }
})

return {
  status: resultConcepts.some((c) => c.status === 'viable') ? 'ok' : 'no-viable',
  concepts: resultConcepts,
  gateVerdicts,
  stats,
  round: { round, firstId, note, concepts: carried.map((c) => c.id), conceptsCompiled: carried.length },
  dossier,
}
