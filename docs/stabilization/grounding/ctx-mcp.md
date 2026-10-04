# ctx-mcp: the MCP protocol, SDK 1.20.2 and Claude Code as the client

Researched 2026-10-03. Legend: **[V]** = read just now in the authoritative source (or observed by a probe I ran); **[I]** = inference.

**Sources**
- SDK: `node_modules/@modelcontextprotocol/sdk` → `.pnpm/@modelcontextprotocol+sdk@1.20.2` (lockfile `pnpm-lock.yaml:11-13`, `package.json` specifier `^1.0.0`). Line numbers below refer to `dist/esm/...` unless noted. **[V]**
- Spec: the SDK's `LATEST_PROTOCOL_VERSION = '2025-06-18'` (`types.js:2`). `SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18','2025-03-26','2024-11-05','2024-10-07']` (`types.js:4`). I read the 2025-06-18 pages as raw markdown (`https://modelcontextprotocol.io/specification/2025-06-18/<page>.md`). Copies are in `scratchpad/formalize/mcpdocs/`. **[V]**
- Claude Code: `https://code.claude.com/docs/en/mcp.md` (read in full, 1,566 lines), plus `env-vars.md`, `debug-your-config.md`, `hooks.md`, `agent-sdk/custom-tools.md`, `agent-sdk/mcp.md` and `errors.md`. Installed CLI: `claude --version` → **2.1.289** (so the version-gated statements below apply). **[V]**
- Probes I ran (scratchpad only): `scratchpad/formalize/sdkprobe/probe.mjs` (in-process `Client`+`Server` over `InMemoryTransport`) and `stdio_eof.mjs` (stdin EOF). Outputs are quoted in §B. **[V]**

---

## A. Protocol (revision 2025-06-18)

| Topic | Fact | Source |
|---|---|---|
| tools/call result shape | `CallToolResult = { _meta?, content: ContentBlock[], structuredContent?: {…}, isError?: boolean }`. On `isError`: "If not set, this is assumed to be false (the call was successful)." **[V]** | `/specification/2025-06-18/schema` § CallToolResult; SDK mirror `types.js:879-908` |
| isError vs JSON-RPC error | Schema text: "Any errors that originate from the tool SHOULD be reported inside the result object, with `isError` set to true, *not* as an MCP protocol-level error response. Otherwise, the LLM would not be able to see that an error occurred and self-correct. However, any errors in *finding* the tool, an error indicating that the server does not support tool calls, or any other exceptional conditions, should be reported as an MCP error response." **[V]** | schema § CallToolResult.isError |
| isError vs JSON-RPC error (tools page) | "Tools use two error reporting mechanisms: 1. **Protocol Errors**: Standard JSON-RPC errors for issues like: Unknown tools, Invalid arguments, Server errors. 2. **Tool Execution Errors**: Reported in tool results with `isError: true`: API failures, Invalid input data, Business logic errors." Example protocol error: `{"code": -32602, "message": "Unknown tool: invalid_tool_name"}`. **[V]** | `/server/tools` § Error Handling |
| Later revision (for context) | The current "latest" spec is 2026-07-28 (`/specification/latest/...` redirects there). It moves "Input validation errors (e.g., date in wrong format, value out of range)" to the **Tool Execution Errors** (`isError`) list. Protocol errors become "Unknown tool / Malformed requests (fail CallToolRequest schema) / Server errors". **[V]** | `/specification/2026-07-28/server/tools` § Error Handling |
| Content types | `text`, `image` (base64 `data` + `mimeType`), `audio`, `resource_link` (`uri`, `name`, …), `resource` (embedded). All accept optional `annotations` (audience, priority, lastModified). SDK union: `types.js:741-747`. **[V]** | `/server/tools` § Tool Result |
| structuredContent | "**Structured** content is returned as a JSON object in the `structuredContent` field of a result. For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block." **[V]** | `/server/tools` § Structured Content |
| outputSchema | "If an output schema is provided: Servers **MUST** provide structured results that conform to this schema. Clients **SHOULD** validate structured results against this schema." **[V]** | `/server/tools` § Output Schema |
| Cancellation | `notifications/cancelled {requestId, reason?}`. "Receivers of cancellation notifications **SHOULD**: Stop processing the cancelled request; Free associated resources; Not send a response for the cancelled request." They "**MAY** ignore" it if the request is unknown, already completed, or "cannot be cancelled". "The `initialize` request **MUST NOT** be cancelled by clients." Both sides "**MUST** handle these race conditions gracefully." **[V]** | `/basic/utilities/cancellation` § Behavior Requirements, § Timing |
| Progress | The requester puts `params._meta.progressToken` (a string or integer, "**MUST** be unique across all active requests") on the request. The receiver "**MAY** then send" `notifications/progress {progressToken, progress, total?, message?}`. "The `progress` value **MUST** increase with each notification, even if the total is unknown." The receiver may send none at all. "Progress notifications **MUST** only reference tokens that: Were provided in an active request". "Progress notifications **MUST** stop after completion". **[V]** | `/basic/utilities/progress` |
| Timeouts | "Implementations **SHOULD** establish timeouts for all sent requests … the sender **SHOULD** issue a cancellation notification for that request and stop waiting." "Implementations **MAY** choose to reset the timeout clock when receiving a progress notification … However, implementations **SHOULD** always enforce a maximum timeout, regardless of progress notifications". The spec sets **no numeric default**. The tools page also says clients "**SHOULD** … Implement timeouts for tool calls". **[V]** | `/basic/lifecycle` § Timeouts; `/server/tools` § Security Considerations |
| Concurrency | The spec has no sentence that allows or forbids concurrent processing. It assumes several requests can be in flight at once ("unique across all active requests"; cancelling "in-progress" requests), request IDs must not be reused within a session, and 2025-06-18 **removed JSON-RPC batching** (changelog item 1). **[V]** **Conclusion [I]:** a server may process requests concurrently and responses may arrive out of order (they are matched by `id`). | `/basic/utilities/progress`; `/basic/index` § Requests; `/changelog` |
| stdio | "The server **MAY** write UTF-8 strings to its standard error (`stderr`) for logging purposes. Clients **MAY** capture, forward, or ignore this logging." "The server **MUST NOT** write anything to its `stdout` that is not a valid MCP message." Messages are newline-delimited. **[V]** | `/basic/transports` § stdio |
| stdio shutdown | "the client **SHOULD** initiate shutdown by: 1. First, closing the input stream to the child process … 2. Waiting for the server to exit, or sending `SIGTERM` if the server does not exit within a reasonable time 3. Sending `SIGKILL` …" **[V]** | `/basic/lifecycle` § Shutdown › stdio |
| Pre-handshake | "The client **SHOULD NOT** send requests other than pings before the server has responded to the `initialize` request." "The server **SHOULD NOT** send requests other than pings and logging before receiving the `initialized` notification." The spec says nothing about server-side network I/O. **[V]** | `/basic/lifecycle` § Initialization |

---

## B. SDK 1.20.2 behaviour (from source, confirmed by probes)

### B1. Incoming requests are dispatched concurrently: **YES** [V]
`Protocol._onrequest` (`shared/protocol.js:130-188`) starts the handler in a detached promise chain and returns immediately. Nothing awaits or queues one request behind another:
```js
// shared/protocol.js:159-169
Promise.resolve()
    .then(() => handler(request, fullExtra))
    .then(result => {
    if (abortController.signal.aborted) { return; }
    return capturedTransport?.send({ result, jsonrpc: '2.0', id: request.id });
```
`StdioServerTransport.processReadBuffer` (`server/stdio.js:35-49`) calls `onmessage` synchronously for every complete line in a chunk, so two `tools/call` lines start two handlers back to back.
Probe output: `server: start slow` at 18 ms, then `server: start fast` / `end fast` / `client: fast resolved` at 19–20 ms, and `end slow` only at 350 ms. **The second call started and finished before the first resolved.**
→ Any shared engine state needs the server's own lock (vision D-8). The SDK gives no serialization.

### B2. Low-level `Server.setRequestHandler` vs `McpServer.registerTool`/`tool`
- **The repo uses the low-level `Server`** with hand-written handlers: `src/index.ts:3` (import), `:69` (`new Server`), `:273` (`ListToolsRequestSchema`), `:320` (`CallToolRequestSchema`). There are no `McpServer`/`registerTool`/`.tool(` calls. **[V]**
- **A throw inside a low-level handler becomes a JSON-RPC error, not `isError`.** The code is `code: Number.isSafeInteger(error['code']) ? error['code'] : ErrorCode.InternalError, message: error.message ?? 'Internal error'` (`shared/protocol.js:170-183`). Probe: `throw -> JSON-RPC error McpError -32603 MCP error -32603: boom from low-level handler`. `setRequestHandler` also runs `requestSchema.parse(request)` inside that chain (`protocol.js:367-373`), so a malformed request also becomes −32603. **[V]**
- **Today's repo catch block** (`src/index.ts:355-370`) turns every routed error into `{content:[{type:"text",text:"Error: …"}]}` **without `isError`**. That is the E6 defect: to the client it looks like a success. **[V]**
- **`McpServer.registerTool`** (`server/mcp.js:532-538` → `_createRegisteredTool` `:447-487` → the handler at `:75-134`):
  - callback throws → `{content:[{type:'text',text:error.message}], isError:true}` (`mcp.js:91-104`). Probe: `{"content":[{"type":"text","text":"negative!"}],"isError":true}`. **[V]**
  - zod input-validation failure → **JSON-RPC −32602** `Invalid arguments for tool …` (`mcp.js:85-88`), **not** isError. **[V]**
  - unknown or disabled tool → JSON-RPC −32602 `Tool X not found` / `disabled` (`mcp.js:77-82`). **[V]**
  - `outputSchema` set but no `structuredContent` (and not `isError`) → JSON-RPC −32602 (`mcp.js:123-131`). **[V]**
  - `tool()` overloads are "frozen as of protocol version 2025-03-26" (`mcp.js:499-501`). `registerTool` is the current API. **[V]**

### B3. `InMemoryTransport.createLinkedPair()` and in-process `Client` [V]
- Location: `dist/esm/inMemory.js:11-17` and `dist/cjs/inMemory.js`. Import path: `@modelcontextprotocol/sdk/inMemory.js`. The package's `exports["./*"]` maps `require` to `./dist/cjs/*` (`package.json` exports). Under the repo's ts-jest CommonJS config (`tsconfig.test.json` `module: CommonJS`), `require("@modelcontextprotocol/sdk/inMemory.js")` and `…/client/index.js` both resolve. I ran this from the repo root: `function function`. **[V]**
- Semantics: `send()` calls the peer's `onmessage` **synchronously**, or queues the message until `start()` (`inMemory.js:37-47`). `close()` closes the peer and fires `onclose` on both sides (`:26-32`). No serialization and no newline framing, so it cannot catch stray-stdout or framing bugs **[I]**.
- Usage (the pattern my probe used):
  ```ts
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([client.connect(clientT), server.connect(serverT)]);
  const r = await client.callTool({ name, arguments: args }, CallToolResultSchema, { timeout, onprogress, signal });
  ```
  `Client.connect` performs `initialize` and `notifications/initialized` (`client/index.js:60-96`). `callTool` is at `client/index.js:231-258`; it validates `structuredContent` against a cached `outputSchema` only after `listTools()` has populated the cache.
- **Client default per-request timeout is 60 s**: `DEFAULT_REQUEST_TIMEOUT_MSEC = 60000` (`shared/protocol.js:5`, applied at `:306-308`). `resetTimeoutOnProgress` defaults to `false` and `maxTotalTimeout` has no default (`shared/protocol.d.ts:40-62`). A test of a slow tool (for example a simulated 30–120 s trade search) must pass `{ timeout }`, or it fails with `McpError −32001 'Request timed out'` and the client sends `notifications/cancelled` (`protocol.js:271-285, 307`). **[V]**

### B4. AbortSignal and progress for handlers [V]
- Every handler receives `extra` with `signal: AbortSignal`, `_meta` (the request's `_meta`, including `progressToken`), `requestId`, `sendNotification` and `sendRequest` (`protocol.js:146-157`; types `protocol.d.ts:78-113`).
- When `notifications/cancelled` arrives, the request's controller is aborted (`protocol.js:21-24`). The handler **keeps running** unless it checks the signal. The SDK then **suppresses the response** (`protocol.js:162-164`, `172-174`), which is spec-compliant. Probe: `cancelme saw abort, reason= user pressed esc`, then 250 ms later `handler finished anyway; aborted= true`, and no response was sent.
- `Protocol._onclose` (transport closed) rejects only *outgoing* pending requests. It does **not** abort in-flight incoming handlers (`protocol.js:101-113`).
- The SDK does **not** send progress automatically. A handler sends it explicitly: `extra.sendNotification({ method: 'notifications/progress', params: { progressToken: extra._meta.progressToken, progress, total, message } })`, and only when `extra._meta?.progressToken !== undefined`. `notifications/progress` is always allowed for servers (`server/index.js:123-125`). Probe: the client's `onprogress` received `{"progress":1,"total":2,"message":"half"}`.

### B5. `StdioServerTransport` on stdin end/close: **no `onclose`, and no exit of its own** [V]
- `start()` subscribes only to `stdin` `'data'` and `'error'` (`server/stdio.js:27-34`). It has no `'end'` or `'close'` listener. `onclose` fires only from an explicit `transport.close()` (`:50-65`).
- Probe (`stdio_eof.mjs`, stdin closed immediately):
  - No other handles: `process.stdin end event` then `process exit 0`. `server.onclose` **never fired**; the process exited only because the event loop drained.
  - With one live handle (a `setInterval`, standing in for the spawned luajit child at `src/pobLuaBridge.ts:128` or chokidar watchers): `process.stdin end event`, then the process **lingered until killed** (`timeout` exit 124).
  → The server must add its own `process.stdin.on('end'/'close', shutdown)`. Vision I-2 "The server exits on stdin EOF and reaps luajit" is right to require this; the SDK does not provide it.
- `send()` waits for `'drain'` on backpressure (`stdio.js:66-76`). `ReadBuffer` splits on `\n` and parses with `JSONRPCMessageSchema` (`shared/stdio.js:9-27`). A bad line goes to `onerror` and is skipped.
- `Server` does not gate requests on initialization: any registered method is dispatched whether or not `initialize` has happened (`protocol.js:130-145`). An unknown method gets `-32601 Method not found` (`:135-144`). `Server.oninitialized` (`server/index.js:49`, `index.d.ts:47`) is the hook for "after handshake" work.

### B6. zod version and SDK API types [V]
- SDK dependency: `"zod": "^3.23.8"` and `"zod-to-json-schema": "^3.24.1"` (SDK `package.json` dependencies). Resolved to **`zod@3.25.76`** (`node_modules/.pnpm/zod@3.25.76`). The root export of 3.25.76 is the **v3 API** (`index.d.ts`: `export * from "./v3/external.js"`). The v4 API is only at the `zod/v4` subpath.
- The SDK's public types are zod-v3 typed: `mcp.d.ts:2` imports `ZodRawShape, ZodObject, AnyZodObject, ZodTypeAny…` from `'zod'`. `registerTool<InputArgs extends ZodRawShape, OutputArgs extends ZodRawShape>(name, {title?, description?, inputSchema?, outputSchema?, annotations?, _meta?}, cb)` is at `mcp.d.ts:104-111`. At runtime the SDK wraps raw shapes with its **own v3** `z.object(...)` (`mcp.js:451-452`) and converts them with `zodToJsonSchema` (`mcp.js:58-70`). The SDK README's own install line is `npm install @modelcontextprotocol/sdk express zod@3` (README:133).
- **Probe with zod v4 schemas passed to `registerTool` on 1.20.2:** `listTools` returned `{"type":"object","properties":{},…}` (**the input schema was silently emptied**), and `callTool` failed with `MCP error -32603: keyValidator._parse is not a function`. **zod v4 is incompatible with SDK 1.20.2's McpServer.**
- For the repo **[I]**: the low-level `Server` takes JSON Schema, so zod used only for the TS↔Lua contract (D-10) does not touch the SDK, and either major version would work. Pinning the direct dependency to `zod@3.25.76` (same as the SDK's) dedupes the install and keeps a later move to `McpServer.registerTool` possible. If v4 semantics are wanted, `import { z } from 'zod/v4'` from the same 3.25.x package is the bridge, but those schemas must never reach SDK 1.20.2 APIs.
- Note **[V]**: zod-to-json-schema emits `"$schema":"http://json-schema.org/draft-07/schema#"` (seen in the probe). See C9 for how Claude Code treats a declared dialect.

---

## C. Claude Code as the MCP client (official docs, CLI 2.1.289)

### C1. Registration syntax [V]
- `claude mcp add [options] <name> -- <command> [args...]` (mcp.md § Option 3: Add a local stdio server).
- "For stdio servers, the `--` (double dash) separates Claude's own options, such as `--transport`, `--env`, and `--scope`, from the command and arguments that run the server. **Everything after `--` is passed to the server untouched.**" (mcp.md § Option 3, Note).
- Scope: "Use the `-s` or `--scope` flag … `local` (default) … `project` … `user`: available to you across all projects". Env: "Set environment variables with `-e` or `--env` flags (for example, `-e KEY=value`)" (mcp.md § Tips after Push messages with channels).
- Gotcha: "`--env` accepts multiple `KEY=value` pairs. If the server name comes directly after `--env`, the CLI reads the name as another pair and rejects it". Docs example with the env after the name: `claude mcp add example --env API_KEY=your-key -- npx -y @example/mcp-server` (mcp.md § From an npx, uvx, or binary command).
- Local CLI help (`claude mcp add --help`, v2.1.289): `-s, --scope <scope> … (default: "local")`; `-t, --transport … Defaults to stdio if not specified.`; `-e, --env <env...>`; example `claude mcp add my-server -e API_KEY=xxx -- npx my-mcp-server`. There is **no `--timeout` flag**.
- Server names: "only letters, numbers, hyphens, and underscores" (mcp.md § Import MCP servers from Claude Desktop). User scope is stored in `~/.claude.json` (mcp.md § MCP installation scopes).

### C2. Launch cwd and environment
- cwd: "Relative file paths in `command` or `args` are a frequent cause, since they resolve against **the directory you launched Claude Code from** rather than the location of `.mcp.json`" (debug-your-config.md § Check MCP servers). The fix row says "Use absolute paths for local scripts." **[V]** → The server process's cwd = Claude Code's launch directory **[I]**. The process cwd itself is not stated in so many words.
- Claude Code "sets `CLAUDE_PROJECT_DIR` in the spawned server's environment to the project root" (mcp.md § Option 3). Also set: `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID` (env-vars.md). `CLAUDE_CODE_CHILD_SESSION` is *not* set for stdio MCP servers, "which are long-lived and outlive the session that spawned them" (env-vars.md). **[V]**
- Env inheritance: servers get "the environment Claude Code passes to stdio servers: its own environment, minus the variables it strips from subprocesses" (debug-your-config.md § Common causes table). Opt-in variables change this: `CLAUDE_CODE_MCP_ALLOWLIST_ENV=1` → "spawn stdio MCP servers with only a safe baseline environment plus the server's configured `env`"; `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips credentials from "MCP stdio servers" (env-vars.md). **[V]** → A `POESESSID` exported in the user's shell would reach the server unless a scrub applies **[I]**.
- `mise exec -C <dir> -- node …`: I ran it from `/tmp`. The child's `pwd` = `/home/parker/projects/pob2-mcp` and node = `~/.local/share/mise/installs/node/24/bin/node` (v24.16.0). `mise exec` **execs in place**: the child's parent PID was the calling shell, so no mise process is left in between, and signals and stdin EOF reach node directly. **[V, local experiment, mise 2026.5.15]**

### C3. Timeout and output environment variables: exact defaults [V]
| Variable | Doc sentence (env-vars.md § Variables unless noted) |
|---|---|
| `MCP_TIMEOUT` | "Timeout in milliseconds for MCP server startup (default: 30000, or 30 seconds)". agent-sdk/mcp.md § Connection timeouts adds: "MCP server connections time out after 30 seconds by default." |
| `MCP_TOOL_TIMEOUT` | "Timeout in milliseconds for MCP tool execution (default: 100000000, about 28 hours). … Stdio and WebSocket servers have no per-request timer. A per-server `timeout` field in `.mcp.json` overrides this for that server." |
| per-server `timeout` | "Set a per-server tool execution timeout by adding a `timeout` field in milliseconds to that server's `.mcp.json` entry". "The per-server `timeout` is a hard wall-clock limit per tool call, and progress notifications from the server don't extend it. Values below 1000 are ignored" (mcp.md § Tips / following paragraph). |
| `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | "When a stdio, HTTP, … server sends no response and no progress notification for this long, the tool call aborts with an error … Overrides the per-transport defaults of 300000 (5 minutes) for network servers and **1800000 (30 minutes) for stdio servers**. Set to `0` to disable". mcp.md: "Before v2.1.203, stdio servers were exempt from the idle timeout." |
| `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` | "Elapsed time in milliseconds before a still-running MCP tool call moves to a background task (default: 120000, or 2 minutes). Set to `0` to turn automatic backgrounding off." |
| `MAX_MCP_OUTPUT_TOKENS` | "Maximum number of tokens allowed in MCP tool responses. Claude Code displays a warning when output exceeds 10,000 tokens. … (default: 25000)". mcp.md: "the warning threshold is fixed". Over the limit: "Claude Code saves it to a file and replaces it in the conversation with a message that names the file path" (mcp.md § MCP output limits and warnings). A per-tool override is `_meta["anthropic/maxResultSizeChars"]` in the `tools/list` entry, "up to a hard ceiling of 500,000 characters" (mcp.md § Raise the limit for a specific tool). |
| `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` | "(default: 2048)". mcp.md: "Claude Code truncates each tool description and each server's instructions at 2,048 characters by default." |
| `MCP_CONNECTION_NONBLOCKING` / `MCP_CONNECT_TIMEOUT_MS` | "MCP startup is non-blocking by default: servers connect in the background" / blocking-startup wait "(default: 5000) … Distinct from `MCP_TIMEOUT`". `MCP_SERVER_CONNECTION_BATCH_SIZE` "(default: 3)" for stdio. |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | "Maximum number of read-only tools and subagents that can execute in parallel (default: 10)" |

### C4. Server stderr [V]
"run `claude --debug=mcp` and read the server's stderr in the debug log at `~/.claude/debug/<session-id>.txt`" (debug-your-config.md § Check MCP servers; also channels-reference.md). Stderr goes to the debug log. The docs do not say it is shown to Claude. **[I]**: Claude never sees stderr, so it is safe for diagnostics.

### C5. Parallel calls to the same server: **YES** [V]
- `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`: "Maximum number of read-only tools and subagents that can execute in parallel (default: 10)" (env-vars.md).
- `readOnlyHint` "Controls whether the tool can be called in parallel with other read-only tools" (agent-sdk/custom-tools.md § Add tool annotations). The quick reference says "Let Claude call tools in parallel | Set `readOnlyHint: true` on tools with no side effects".
- hooks.md § PostToolBatch: "`PostToolUse` fires once per tool, which means it fires concurrently when Claude makes parallel tool calls."
- Auto-backgrounding: "An MCP tool call in the main conversation that is still running after two minutes moves to a background task … Claude receives the task ID immediately and keeps working" (mcp.md § Automatic backgrounding of long tool calls).
- **[I]**: Subagents share the session's MCP connections, so even non-read-only tools can overlap across subagents, and a backgrounded `find_upgrades` can overlap with any later pob2 call. The SDK `Server` will run them concurrently (B1).

### C6. isError display [V/I]
- hooks.md § PostToolUseFailure: "Runs when a tool that started executing fails: the tool threw an error, **or an MCP tool returned an error result**." Claude Code classifies `isError: true` as a failed tool call. **[V]**
- agent-sdk/custom-tools.md § Handle errors (in-process SDK servers): with `isError: true`, "Claude sees the message you compose … Claude can retry, try a different tool, or explain the failure." **[V]**
- How the TUI renders an isError result is **not documented**. **[I]**: Claude sees the text either way. A JSON-RPC error and `isError` both reach Claude as a failed tool result.

### C7. Progress notifications [V/I]
- Idle timeout: a call that "sends no response and no progress notification for the idle window aborts" (mcp.md). **Progress resets the idle clock.** **[V]**
- Wall clock: progress "don't extend" the per-server `timeout` (mcp.md). **[V]**
- Background tasks: "The task's entry shows the latest progress the server has reported" (mcp.md § Automatic backgrounding). **[V]**
- **[I]**: Claude Code puts `_meta.progressToken` on `tools/call`; otherwise no progress could be reported under the spec rule that tokens must come from an active request. The server should send progress only when `extra._meta?.progressToken` is present.

### C8. structuredContent [V/I]
- agent-sdk/custom-tools.md § Return structured data: "When `structuredContent` is set, Claude receives the JSON plus any image or resource blocks from `content`. **Text blocks in `content` are not forwarded**, since they are assumed to duplicate the structured data." **[V]** That statement is on the Agent SDK custom-tools page. mcp.md says nothing about structuredContent.
- **[I] (not confirmed for external stdio servers):** the same rule likely applies to any MCP tool result in Claude Code. If pob2 tools add `structuredContent`, any warning or note that exists only in the text block (for example D-16's "file newer on disk" warning, or "no upgrade within budget") would be invisible to Claude. Either keep results text-only or put everything into the JSON.

### C9. Other client behaviour relevant to this server [V]
- "Stdio servers are local processes, and Claude Code doesn't reconnect them automatically" (mcp.md § Automatic reconnection). A server crash leaves the tools gone until `/mcp` reconnect.
- Input-schema checks: "Top-level property names must be 1 to 64 characters long and use only ASCII letters and digits, `_`, `.`, and `-`". The schema "must be valid against the JSON Schema draft 2020-12 meta-schema … A schema that declares any other dialect skips this check" (mcp.md § Tools with invalid input schemas). A root-level `anyOf/oneOf/allOf` gets flattened.
- Client runtimes: "The v1 runtime is built on MCP TypeScript SDK 1.x. The v2 runtime is the same code on MCP TypeScript SDK 2.0, which adds MCP protocol revision 2026-07-28". On v2.1.285+ "it asks stdio servers as Anthropic rolls that change out"; it "connects to every other server as v1 does". Overrides: `MCP_PROTOCOL_NEGOTIATION=legacy` / `MCP_SDK_GENERATION=v1` (mcp.md § MCP client runtimes). **[I]**: our 1.20.2 server answers `initialize` with `2025-06-18` when asked for an unsupported version (`server/index.js:169`) and returns −32601 for unknown methods, so negotiation should fall back cleanly. This is not tested.
- Startup: `MCP_TIMEOUT` (30 s) bounds the connect attempt. Startup is non-blocking by default, so a slow server is not user-visible until it fails.

### C10. Doc statements relevant to a 30–120 s trade search [V]
- No numeric limit applies by default: wall clock ≈28 h, stdio has no per-request timer, and the stdio idle window is 30 min (reset by progress).
- At **120 s** a main-conversation call **auto-backgrounds** and Claude continues working. The result arrives later as a task notification. Subagent calls never background.
- "These timeouts bound how long a call can run, not always how long it blocks the session" (mcp.md).
- Sending `notifications/progress` during rate-limit waits keeps the idle clock fresh and shows status in `/tasks` **[V for effect, I for token presence]**.
- The user can stop the task from `/tasks` **[V]**. Whether that sends `notifications/cancelled` is not documented. **[I]**: the v1 runtime's SDK `request()` sends `notifications/cancelled` on abort (`protocol.js:271-285`), so likely yes.

---

## D. Contradictions and gaps with vision.md

1. **D-16 (registration command): `POB_DIRECTORY` is not passed.** Q6 makes `POB_DIRECTORY=/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds` "this user's configured value". But the documented command `claude mcp add pob2 -s user -- mise exec -C ~/projects/pob2-mcp -- node build/index.js` has no `-e`, and `mise.toml` `[env]` sets only `LUAROCKS_VERSION`. The server would fall back to its default, not the WSL path, unless the user's shell exports it (stdio servers inherit Claude Code's env, C2). Fix: `claude mcp add pob2 -s user -e "POB_DIRECTORY=/mnt/c/Users/parke/Documents/Path of Building (PoE2)/Builds" -- mise exec -C /home/parker/projects/pob2-mcp -- node build/index.js`, with `-e` after the name per the gotcha in C1.
   - The rest of D-16's syntax checks out against docs and CLI help: `-s user` after the name, the double `--` (the second goes to mise untouched), and stdio as the default transport.
   - `mise exec -C` fixes the cwd regardless of Claude Code's launch directory, and it execs in place (C2).
   - `~` is expanded by the user's shell at add time [I]. Prefer an absolute path in docs and for any `add-json` variant, because JSON gets no tilde expansion.
   - Per-server `timeout` cannot be set via `claude mcp add` (no flag). It is not needed at the defaults.
2. **D-8(e) and I-4 ("`isError: true` on every error" / "Every failure sets `isError`") vs the spec.** 2025-06-18 says unknown tools and invalid arguments are **JSON-RPC protocol errors** (`/server/tools` § Error Handling; example code −32602). The 2026-07-28 revision moves input-validation errors to `isError` but still makes unknown tools protocol errors. Claude Code treats both as failed calls (C6), so this is low risk, but "every" overreaches. Decide explicitly how the router handles an unknown tool name: −32602, or `isError` as a deliberate deviation.
   - Mechanism the spec must state: with the low-level `Server` the repo uses, a *thrown* error becomes JSON-RPC −32603, not `isError` (B2). The router must catch errors and return `{isError:true}`. Today's catch at `src/index.ts:355-370` omits `isError`, which is the E6 defect.
3. **D-8(a) engine mutex: confirmed necessary, with a gap on cancellation.** SDK concurrency (B1) and Claude Code's parallel, subagent and auto-background calls (C5, C10) make the per-call engine mutex mandatory, not optional.
   - Gap: D-8 does not handle `notifications/cancelled`. The SDK only aborts `extra.signal`; the handler, and any lock it holds, keeps running (B4). `find_upgrades` "holds the lock through its HTTP phase" for up to 120 s, so a cancelled search keeps blocking every other engine call unless the handler checks `extra.signal` between pages and releases the lock.
   - The spec says receivers "SHOULD … Stop processing … Free associated resources".
4. **D-14 (no network before handshake): no contradiction; supported by C3.**
   - `MCP_TIMEOUT` defaults to 30 s for the startup connect, and today's `run()` awaits a trade2 `getStatData()` fetch *before* `server.connect()` (`src/index.ts:377-397`), which is exactly what D-14 removes.
   - The SDK offers `server.oninitialized` (`server/index.js:49`) if a post-handshake warm-up is ever wanted.
   - The spec only restricts *protocol requests* before `initialized`, not network I/O.
5. **D-17 (in-process tests): feasible, with three caveats the spec should state.**
   - (a) The `Client` default request timeout is **60 s** (`protocol.js:5`). Slow-tool tests must pass `{timeout}` (B3), and Jest fake timers also fake this timer [I].
   - (b) `InMemoryTransport` is synchronous and unframed, so it cannot catch stdout pollution or stdin-EOF behaviour. I-2's "exits on stdin EOF and reaps luajit" needs a real-stdio child-process test. The SDK provides no EOF handling, so the server must add a `process.stdin` `'end'`/`'close'` listener (B5).
   - (c) CJS resolution under the repo's ts-jest config works (B3).
6. **D-10 (zod as a direct dependency): not a contradiction, but pin v3.** SDK 1.20.2's zod-typed APIs are v3-only, and v4 schemas silently produce an empty `inputSchema` and fail at call time (B6). Pin `zod@3.25.76` (dedupes with the SDK). Use `zod/v4` only internally if wanted.
7. **Output-shape risk not covered by the vision (C8).** If any tool adopts `structuredContent`, Claude may not see the text block. D-6's warnings and "no upgrade within budget" text must not live only in text if structuredContent is added.

---

## E. Open unknowns
- Whether Claude Code (CLI, external stdio servers) drops text content when `structuredContent` is present. This is documented only for Agent SDK in-process tools (C8).
- Whether `/tasks` stop or Esc sends `notifications/cancelled` to a stdio server. Not documented, though likely given the SDK client (C10).
- The exact `_meta.progressToken` presence on Claude Code's `tools/call`. Implied but not stated (C7).
- How Claude Code's v2 runtime probes a stdio server for 2026-07-28, and whether a 1.20.2 server negotiates down cleanly on 2.1.289 (C9). Mitigations: `MCP_PROTOCOL_NEGOTIATION=legacy` or `MCP_SDK_GENERATION=v1`.
- Whether `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` would strip a `POESESSID` (name-pattern based) if the user enabled it.
- The TUI rendering of `isError` results (undocumented).
