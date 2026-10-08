export const meta = {
  name: 'harness-demo',
  description: 'AC-W3 fixture: exercises every global the workflow harness fakes',
  whenToUse: 'only in tests',
  phases: [
    { title: 'Fan out', detail: 'three agents behind a barrier' },
    { title: 'Pipeline', detail: 'two items, two stages, no barrier' },
  ],
}

// A task header (slice 03 section 5.1) leads every prompt.
const header = (stage, extra) =>
  '```json\n' + JSON.stringify({ stage, attempt: 1, mode: args.mode, runFolder: args.runFolder, ...extra }) + '\n```\n'

const SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }

phase('Fan out')
log(`demo for ${args.runFolder}`)
const fanned = await parallel(
  ['a', 'b', 'c'].map((n) => () => agent(header('R1a', { n }) + `research part ${n}`, { agentType: 'build-guide-researcher', label: `r1a-${n}` })),
)
const after = await agent(header('R1b', { concept: 'c1', compile: 'measure-only' }) + 'compile', {
  agentType: 'build-guide-coordinator',
  schema: SCHEMA,
})

phase('Pipeline')
const piped = await pipeline(
  ['x', 'y'],
  (item) => agent(header('S1', { item }) + 'stage one', { agentType: 'build-guide-coordinator', phase: 'Pipeline' }),
  (prev, item, index) => agent(header('S2', { item, index, prev }) + 'stage two', { agentType: 'build-guide-coordinator' }),
)

const thrown = await parallel([() => { throw new Error('a failed thunk') }, () => 'kept'])
const stamped = new Date(0).toISOString()

return { fanned, after, afterWasNull: after === null, piped, thrown, stamped, budgetTotal: budget.total }
