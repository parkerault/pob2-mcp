# Grounding: Claude Code platform questions (2026-10-07)

Source: a `claude-code-guide` agent answering from the current Claude Code docs. The coordinator
cross-checked these answers against the Workflow tool's own description in this session. The reference rows
are "Claude Code subagents and MCP" and "Skill → saved workflow". The spike is S-c.

## 1. Do agents share the MCP server, and so the engine? (spike S-c)

- **Subagents that reference a configured server by name share it.** They reuse the parent session's single
  connection, and so one server process: one engine with one loaded build.
  Source: <https://code.claude.com/docs/en/sub-agents.md>
- **Workflow-script agents share it too.** The Workflow tool's description in this session says "Workflow
  agents can reach all session-connected MCP tools via ToolSearch", so they use the same connections.
- **A subagent can get its own server.** A subagent definition can declare an MCP server inline. That
  starts a separate server subprocess for that agent, isolated from the session's server
  (sub-agents.md). This has not been tried with pob2-mcp yet. It needs a probe before the design relies
  on it.

**Verdict: confirmed.** Agents that share the session's server contend for one loaded build. Row 30
(engine stages run serially through one coordinator) stands. An inline per-agent server is a possible
later way to run stages in parallel, for example compiling the budget and non-budget variants at the same
time.

## 2. Can a skill start a saved workflow?

- **What the guide agent found.** Saved workflows live in `.claude/workflows/` (project scope) or
  `~/.claude/workflows/` (user scope), and take input through `args`
  (<https://code.claude.com/docs/en/workflows.md>). Its view: a skill can't launch one "programmatically",
  because Claude decides whether to follow the skill's instructions.
- **The coordinator's cross-check.** The Workflow tool's description lists "The user invoked a skill or
  slash command whose instructions tell you to call Workflow" as valid opt-in. It also accepts `name` for a
  saved workflow and `args` for its input.

**Verdict: confirmed.** A skill tells Claude to call `Workflow({name, args})`. That's an instruction
Claude follows, like every skill step, rather than a hard-wired call. Row 29 (a skill plus a saved
workflow) stands.

## 3. Can research agents be limited to lookup tools?

- **Yes.** In a subagent definition's frontmatter, `tools` is an allowlist and `disallowedTools` is a
  denylist (sub-agents.md).
- **Matching MCP tools.**
  - `mcp__<server>` and `mcp__<server>__*` both match every tool on one server.
  - `mcp__*` matches every MCP tool, and works only in a denylist.
  - A single tool is named `mcp__<server>__<tool>`.

**Verdict: confirmed.** A research agent can be given only the read-only lookup tools. Note: the
build-orchestrator skill says an allowlist drops inherited MCP tools unless they are named explicitly. So
name each lookup tool in the list.

## 4. Can one plugin bundle the server, skills and workflows? (decision 36, deferred)

- **Yes.** A plugin can bundle MCP servers, skills and commands or workflows. A stdio server is declared
  with `command` and `args`, using `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`.
  Source: <https://code.claude.com/docs/en/plugins/manifest-reference.md>
- **Not documented:** whether `mise` is on PATH for a plugin's subprocess.

**Verdict: confirmed, with one open point.** When packaging is picked up, test the `mise exec` launch, or
ship a wrapper script that sets up the environment.

## 5. The saved-workflow script format (added during the spec review, 2026-10-07)

Source: the Workflow tool's own description, as loaded in the coordinator's Claude Code session on
2026-10-07. The public docs don't cover this level of detail. These facts are binding for WU-43's test
harness and for every saved workflow:

- **What a script is.** Plain JavaScript, not TypeScript. It must begin with `export const meta = {…}`, a
  **pure literal** (no variables, calls, spreads or interpolation):
  - required: `name` and `description`;
  - optional: `whenToUse` and `phases: [{title, detail?, model?}]`.
- **Where scripts live, and inputs.** Saved workflows live in `.claude/workflows/` (project) or
  `~/.claude/workflows/` (user). They are invoked as `Workflow({name, args})`, and `args` arrives
  verbatim as the global `args`.
- **The script body.** It runs in an async context with top-level `await`. Its globals:
  - `agent(prompt, {label, phase, schema, model, effort, isolation, agentType})`. With `schema`, this
    returns the validated object; it returns `null` if the agent died or was skipped.
  - `parallel(thunks)`, a barrier where a failed thunk gives `null`;
  - `pipeline(items, ...stages)`;
  - `phase(title)` and `log(msg)`;
  - `budget`;
  - `workflow(nameOrRef, args)`, nesting one level only;
  - `args`.
- **What scripts can't use.** `Date.now()`, `Math.random()` and an argless `new Date()` throw, because
  they would break resume. There is also no filesystem and no Node API.
- **Concurrency.** Workflow agents reach every session-connected MCP tool through ToolSearch. At most
  min(16, CPUs − 2) agents run at once, with a lifetime cap of 1000.
- **The run journal.** Each run's journal (`journal.jsonl` in the transcript directory) records every
  agent's return value. It is the source for post-run inspection.

Implication for testing: ts-jest here compiles to CommonJS (`jest.config.cjs`), so a test can't `import`
a workflow script. The harness reads the script as text, takes the `meta` literal out, and runs the body
inside an `async function` with injected fakes for the globals.
