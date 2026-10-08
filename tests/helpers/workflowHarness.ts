/**
 * The workflow harness (WU-43, AC-W3): runs a saved workflow script (`.claude/workflows/*.js`) under Jest
 * with scripted agent results, the way platform §5 (`docs/design/grounding/2026-10-07-claude-code-platform.md`)
 * describes the Workflow tool running it.
 *
 * - **Loading.** ts-jest compiles to CommonJS here, so a test can't `import` a script. The harness reads the
 *   `.js` file as text and parses it with TypeScript's parser. The script must begin with
 *   `export const meta = {…}`, a pure literal: no variables, calls, spreads or interpolation. The harness
 *   takes that literal out as data and blanks the statement, keeping line numbers. Anything else that
 *   imports or exports is refused (a script has no module system).
 * - **Running.** The body runs inside an `async function` (top-level `await` and `return` work) in a fresh
 *   `vm` context, with no `require`, `process` or timers, and fakes for the globals `agent`, `parallel`,
 *   `pipeline`, `phase`, `log`, `budget`, `workflow` and `args`. In that context `Date.now()`,
 *   `Math.random()` and an argless `new Date()` throw, as on the platform (they would break resume).
 * - **Agents.** `agent(prompt, opts)` records the call (its options and its task header, the fenced `json`
 *   block a prompt starts with, slice 03 §5.1), asks the test's responder for the result, and stays in
 *   flight for a few macrotask turns, so concurrency is real and measured (`maxInFlight`). A responder
 *   result of `null` reaches the script as `null`, as a dead or skipped agent's does. Calls queue beyond
 *   the platform's concurrency cap (default 16) and fail beyond its lifetime cap of 1000.
 * - **`parallel(thunks)`** is a barrier: it resolves when every thunk has, and a thunk that throws gives
 *   `null`. **`pipeline(items, ...stages)`** has no barrier: each item runs its stages on its own, a stage
 *   gets `(previous, item, index)`, and a stage that throws drops that item to `null`.
 * - **`workflow(name, args)`** runs another saved workflow from `workflowsDir` inline, sharing the counters;
 *   it nests one level only.
 *
 * Results cross back as JSON (the platform journals them as JSON), and errors as `WorkflowRunError`, which
 * keeps the calls made so far.
 *
 * Known gaps against the platform (accepted in review):
 * - A responder that throws makes `agent()` throw. On the platform an agent that dies returns `null`; to
 *   script that, return `null` from the responder instead of throwing.
 * - With `opts.schema`, the schema's shape is checked as the platform checks it (root type `object`,
 *   `required` ⊆ `properties`), but the scripted result is not validated against it: a test's scripted
 *   results must already have the shape the schema describes.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

export interface WorkflowMeta {
  name: string;
  description: string;
  whenToUse?: string;
  phases?: { title: string; detail?: string; model?: string }[];
}

export interface LoadedWorkflow {
  file: string;
  meta: WorkflowMeta;
  /** The script with the `meta` statement blanked out; line numbers are kept. */
  body: string;
}

/** A script the platform would refuse to load: the message names the file, the place and the cause. */
export class WorkflowScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowScriptError';
  }
}

export interface AgentOptions {
  label?: string;
  phase?: string;
  schema?: Record<string, unknown>;
  model?: string;
  effort?: string;
  isolation?: string;
  agentType?: string;
}

export interface AgentCall {
  /** 0-based, in call order across the run (nested workflows included). */
  index: number;
  /** `meta.name` of the script that made the call. */
  workflow: string;
  prompt: string;
  opts: AgentOptions;
  /** The task header: the fenced `json` block the prompt starts with, parsed; null when there is none. */
  header: Record<string, unknown> | null;
  /** Why the header couldn't be parsed, when the prompt starts with a `json` fence that isn't JSON. */
  headerError?: string;
  /** `opts.phase`, else the last `phase()` title, else null. */
  phase: string | null;
  /** Logical times (one tick per start or end event) at which the agent started and ended. */
  startTick: number;
  endTick: number | null;
  /** The responder's result, as the script received it (JSON). */
  result?: unknown;
}

export type Responder = (call: AgentCall) => unknown;

export interface RunOptions {
  /** The global `args`, passed verbatim (as JSON). */
  args?: unknown;
  /** Scripted agent results. Return `null` for a dead or skipped agent; throw to make `agent()` throw. */
  respond: Responder;
  /** Macrotask turns a call stays in flight before it resolves (default 1). */
  delay?: (call: AgentCall) => number;
  /** Concurrent agents before calls queue (default 16, the platform's maximum). */
  concurrencyCap?: number;
  /** The global `budget`: `total` (null for none) and output tokens charged per agent (default 0). */
  budget?: { total: number | null; perAgent?: number };
  /** Where `workflow(name)` finds saved workflows (default: the repo's `.claude/workflows`). */
  workflowsDir?: string;
}

export interface HarnessEvent {
  tick: number;
  type: 'start' | 'end';
  index: number;
}

export interface RunResult {
  /** The script's return value, as JSON. */
  result: unknown;
  calls: AgentCall[];
  /** The most agents in flight at once. */
  maxInFlight: number;
  events: HarnessEvent[];
  logs: string[];
  /** Every `phase()` title, in call order. */
  phases: string[];
}

/** A script that threw while running; `calls` and `maxInFlight` describe the run up to the throw. */
export class WorkflowRunError extends Error {
  constructor(
    message: string,
    readonly calls: AgentCall[],
    readonly maxInFlight: number,
  ) {
    super(message);
    this.name = 'WorkflowRunError';
  }
}

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const WORKFLOWS_DIR = path.join(REPO_ROOT, '.claude', 'workflows');

/** The platform's lifetime cap on agents per workflow run. */
const LIFETIME_CAP = 1000;
/** The most items one `parallel()` or `pipeline()` call takes. */
const MAX_ITEMS = 4096;
const META_KEYS = ['name', 'description', 'whenToUse', 'phases'];
const PHASE_KEYS = ['title', 'detail', 'model'];

function where(sf: ts.SourceFile, node: ts.Node): string {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `${sf.fileName}:${line + 1}:${character + 1}`;
}

function describeNode(node: ts.Node, sf: ts.SourceFile): string {
  const text = node.getText(sf).split('\n')[0].slice(0, 60);
  if (ts.isIdentifier(node)) return `a variable reference "${text}"`;
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) return `a call "${text}"`;
  if (ts.isTemplateExpression(node)) return `template interpolation "${text}"`;
  if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) return `a spread "${text}"`;
  if (ts.isShorthandPropertyAssignment(node)) return `a shorthand property "${text}", which reads a variable`;
  if (ts.isComputedPropertyName(node)) return `a computed key "${text}"`;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return `a property read "${text}"`;
  return `an expression "${text}" (${ts.SyntaxKind[node.kind]})`;
}

/** The value of a pure literal, or a `WorkflowScriptError` naming the first part that isn't one. */
function literalValue(node: ts.Node, sf: ts.SourceFile): unknown {
  const refuse = (n: ts.Node): never => {
    throw new WorkflowScriptError(
      `${where(sf, n)}: meta must be a pure literal (no variables, calls, spreads or interpolation); found ${describeNode(n, sf)}`,
    );
  };
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression, sf);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((e) => (ts.isSpreadElement(e) || ts.isOmittedExpression(e) ? refuse(e) : literalValue(e, sf)));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p)) return refuse(p);
      if (ts.isComputedPropertyName(p.name)) return refuse(p.name);
      if (!ts.isIdentifier(p.name) && !ts.isStringLiteral(p.name) && !ts.isNumericLiteral(p.name)) return refuse(p.name);
      out[p.name.text] = literalValue(p.initializer, sf);
    }
    return out;
  }
  return refuse(node);
}

function checkMeta(value: unknown, file: string): WorkflowMeta {
  const bad = (why: string): never => {
    throw new WorkflowScriptError(`${file}: meta ${why}`);
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return bad('must be an object literal');
  const m = value as Record<string, unknown>;
  for (const k of Object.keys(m)) if (!META_KEYS.includes(k)) bad(`has an unknown key "${k}"; it takes ${META_KEYS.join(', ')}`);
  if (typeof m.name !== 'string' || m.name.trim() === '') bad('needs a non-empty string name');
  if (typeof m.description !== 'string' || m.description.trim() === '') bad('needs a non-empty string description');
  if (m.whenToUse !== undefined && typeof m.whenToUse !== 'string') bad('whenToUse must be a string');
  if (m.phases !== undefined) {
    if (!Array.isArray(m.phases)) bad('phases must be a list of {title, detail?, model?}');
    (m.phases as unknown[]).forEach((p, i) => {
      if (typeof p !== 'object' || p === null || Array.isArray(p)) return bad(`phases[${i}] must be an object`);
      const ph = p as Record<string, unknown>;
      for (const k of Object.keys(ph)) if (!PHASE_KEYS.includes(k)) bad(`phases[${i}] has an unknown key "${k}"`);
      if (typeof ph.title !== 'string' || ph.title === '') bad(`phases[${i}] needs a string title`);
      for (const k of ['detail', 'model']) if (ph[k] !== undefined && typeof ph[k] !== 'string') bad(`phases[${i}].${k} must be a string`);
    });
  }
  return m as unknown as WorkflowMeta;
}

function isExportedConst(stmt: ts.Statement): stmt is ts.VariableStatement {
  return (
    ts.isVariableStatement(stmt) &&
    (ts.getCombinedModifierFlags(stmt.declarationList.declarations[0]) & ts.ModifierFlags.Export) !== 0 &&
    (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0
  );
}

/** Parse a saved workflow script's text: its `meta` literal and its body. Throws `WorkflowScriptError`. */
export function parseWorkflowScript(source: string, file = 'workflow.js'): LoadedWorkflow {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const first = sf.statements[0];
  const statement = first && isExportedConst(first) ? first : undefined;
  const decl = statement?.declarationList.declarations[0];
  if (!statement || !decl || !ts.isIdentifier(decl.name) || decl.name.text !== 'meta' || statement.declarationList.declarations.length !== 1) {
    throw new WorkflowScriptError(`${file}: a workflow script must begin with \`export const meta = {…}\``);
  }
  if (!decl.initializer || !ts.isObjectLiteralExpression(decl.initializer)) {
    throw new WorkflowScriptError(`${where(sf, decl)}: meta must be an object literal`);
  }
  const meta = checkMeta(literalValue(decl.initializer, sf), file);
  for (const stmt of sf.statements.slice(1)) {
    const exported =
      ts.canHaveModifiers(stmt) && (ts.getModifiers(stmt) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt) || ts.isExportAssignment(stmt) || exported) {
      throw new WorkflowScriptError(`${where(sf, stmt)}: a workflow script has no imports or exports besides meta`);
    }
  }
  const start = first.getStart(sf);
  const end = first.getEnd();
  const body = source.slice(0, start) + source.slice(start, end).replace(/[^\n]/g, ' ') + source.slice(end);
  return { file, meta, body };
}

/** Read and parse a saved workflow script file. */
export function loadWorkflowScript(file: string): LoadedWorkflow {
  return parseWorkflowScript(fs.readFileSync(file, 'utf8'), file);
}

/** Load a saved workflow of this repo by name: `.claude/workflows/<name>.js`. */
export function loadSavedWorkflow(name: string): LoadedWorkflow {
  return loadWorkflowScript(path.join(WORKFLOWS_DIR, `${name}.js`));
}

/** Whether two recorded agent calls were in flight at the same time. */
export function overlaps(a: AgentCall, b: AgentCall): boolean {
  const aEnd = a.endTick ?? Infinity;
  const bEnd = b.endTick ?? Infinity;
  return a.startTick < bEnd && b.startTick < aEnd;
}

/** Parse the task header (slice 03 §5.1): a fenced `json` block at the very start of the prompt. */
export function parseTaskHeader(prompt: string): { header: Record<string, unknown> | null; error?: string } {
  const m = /^\s*```json[ \t]*\r?\n([\s\S]*?)\r?\n```/.exec(prompt);
  if (!m) return { header: null };
  try {
    const value: unknown = JSON.parse(m[1]);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { header: null, error: 'the json block is not an object' };
    return { header: value as Record<string, unknown> };
  } catch (e) {
    return { header: null, error: (e as Error).message };
  }
}

/** What the platform refuses about a schema (root `{type: 'object', properties}`, `required` ⊆ properties). */
function schemaProblem(schema: unknown): string | null {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return 'a schema is an object';
  const s = schema as Record<string, unknown>;
  if (s.type !== 'object') return "a schema's root has type 'object'";
  if (typeof s.properties !== 'object' || s.properties === null) return "a schema's root has properties";
  const props = Object.keys(s.properties as object);
  if (s.required !== undefined) {
    if (!Array.isArray(s.required)) return 'required is a list';
    const missing = (s.required as unknown[]).filter((k) => typeof k !== 'string' || !props.includes(k));
    if (missing.length > 0) return `required names keys that aren't properties: ${missing.join(', ')}`;
  }
  return null;
}

const toJson = (v: unknown): unknown => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Runs in the script's realm before the body: the clock and randomness throw, as on the platform. */
const PRELUDE = `(() => {
  const RealDate = Date;
  const refuse = (what) => { throw new Error(what + ' is not available in a workflow script (it would break resume); pass times in args'); };
  function WorkflowDate(...a) {
    if (!new.target) return refuse('Date()');
    if (a.length === 0) return refuse('new Date() without arguments');
    return Reflect.construct(RealDate, a, new.target);
  }
  WorkflowDate.prototype = RealDate.prototype;
  WorkflowDate.UTC = RealDate.UTC;
  WorkflowDate.parse = RealDate.parse;
  WorkflowDate.now = () => refuse('Date.now()');
  globalThis.Date = WorkflowDate;
  Math.random = () => refuse('Math.random()');
})();`;

interface SharedState {
  options: RunOptions;
  calls: AgentCall[];
  events: HarnessEvent[];
  logs: string[];
  phases: string[];
  tick: number;
  inFlight: number;
  maxInFlight: number;
  waiting: (() => void)[];
  spent: number;
}

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

async function runLoaded(wf: LoadedWorkflow, args: unknown, state: SharedState, depth: number): Promise<unknown> {
  const { options } = state;
  const cap = options.concurrencyCap ?? 16;
  let currentPhase: string | null = null;

  const agent = async (prompt: unknown, opts?: unknown): Promise<unknown> => {
    if (typeof prompt !== 'string') throw new TypeError('agent() takes a prompt string');
    const o = (opts === undefined ? {} : toJson(opts)) as AgentOptions;
    if (o.schema !== undefined) {
      const problem = schemaProblem(o.schema);
      if (problem) throw new Error(`agent(): unsatisfiable schema: ${problem}`);
    }
    if (state.calls.length >= LIFETIME_CAP) throw new Error(`agent(): the lifetime cap of ${LIFETIME_CAP} agents is reached`);
    const total = options.budget?.total ?? null;
    if (total !== null && state.spent >= total) throw new Error('agent(): the token budget is spent');
    const parsed = parseTaskHeader(prompt);
    const call: AgentCall = {
      index: state.calls.length,
      workflow: wf.meta.name,
      prompt,
      opts: o,
      header: parsed.header,
      ...(parsed.error !== undefined ? { headerError: parsed.error } : {}),
      phase: o.phase ?? currentPhase,
      startTick: -1,
      endTick: null,
    };
    state.calls.push(call);
    while (state.inFlight >= cap) await new Promise<void>((resolve) => state.waiting.push(resolve));
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    call.startTick = ++state.tick;
    state.events.push({ tick: call.startTick, type: 'start', index: call.index });
    try {
      const turns = options.delay ? options.delay(call) : 1;
      for (let i = 0; i < turns; i++) await turn();
      const result = toJson(await options.respond(call));
      call.result = result;
      state.spent += options.budget?.perAgent ?? 0;
      return result === undefined ? null : result;
    } finally {
      call.endTick = ++state.tick;
      state.events.push({ tick: call.endTick, type: 'end', index: call.index });
      state.inFlight -= 1;
      state.waiting.shift()?.();
    }
  };

  const parallel = async (thunks: unknown): Promise<unknown[]> => {
    if (!Array.isArray(thunks)) throw new TypeError('parallel() takes a list of functions');
    if (thunks.length > MAX_ITEMS) throw new Error(`parallel() takes at most ${MAX_ITEMS} items; got ${thunks.length}`);
    return Promise.all(
      thunks.map(async (thunk) => {
        try {
          return await (thunk as () => unknown)();
        } catch {
          return null;
        }
      }),
    );
  };

  const pipeline = async (items: unknown, ...stages: unknown[]): Promise<unknown[]> => {
    if (!Array.isArray(items)) throw new TypeError('pipeline() takes a list of items');
    if (items.length > MAX_ITEMS) throw new Error(`pipeline() takes at most ${MAX_ITEMS} items; got ${items.length}`);
    return Promise.all(
      items.map(async (item, index) => {
        let previous: unknown = item;
        for (const stage of stages) {
          try {
            previous = await (stage as (p: unknown, i: unknown, n: number) => unknown)(previous, item, index);
          } catch {
            return null;
          }
        }
        return previous;
      }),
    );
  };

  const phase = (title: unknown) => {
    currentPhase = String(title);
    state.phases.push(currentPhase);
  };
  const log = (message: unknown) => {
    state.logs.push(String(message));
  };
  const total = options.budget?.total ?? null;
  const budget = {
    total,
    spent: () => state.spent,
    remaining: () => (total === null ? Infinity : Math.max(0, total - state.spent)),
  };
  const workflow = async (nameOrRef: unknown, childArgs?: unknown): Promise<unknown> => {
    if (depth >= 1) throw new Error('workflow() nests one level only');
    let file: string;
    if (typeof nameOrRef === 'string') file = path.join(options.workflowsDir ?? WORKFLOWS_DIR, `${nameOrRef}.js`);
    else if (typeof nameOrRef === 'object' && nameOrRef !== null && typeof (nameOrRef as { scriptPath?: unknown }).scriptPath === 'string') {
      file = (nameOrRef as { scriptPath: string }).scriptPath;
    } else throw new TypeError('workflow() takes a saved workflow name or {scriptPath}');
    if (!fs.existsSync(file)) throw new Error(`workflow(): no saved workflow at ${file}`);
    return runLoaded(loadWorkflowScript(file), childArgs, state, depth + 1);
  };

  const context = vm.createContext({ agent, parallel, pipeline, phase, log, budget, workflow, args: toJson(args) });
  vm.runInContext(PRELUDE, context);
  const fn = vm.runInContext(`(async function () {\n${wf.body}\n})`, context, { filename: wf.file, lineOffset: -1 }) as () => Promise<unknown>;
  return fn();
}

/**
 * Run a loaded (or parsed) workflow script with the fakes. Resolves with the result and the record of the
 * run; rejects with `WorkflowRunError`, naming the script and the cause, when the script throws.
 */
export async function runWorkflow(wf: LoadedWorkflow, options: RunOptions): Promise<RunResult> {
  const state: SharedState = {
    options,
    calls: [],
    events: [],
    logs: [],
    phases: [],
    tick: 0,
    inFlight: 0,
    maxInFlight: 0,
    waiting: [],
    spent: 0,
  };
  let result: unknown;
  try {
    result = await runLoaded(wf, options.args, state, 0);
  } catch (e) {
    const err = e as { name?: unknown; message?: unknown };
    const name = typeof err?.name === 'string' ? err.name : 'Error';
    const message = typeof err?.message === 'string' ? err.message : String(e);
    throw new WorkflowRunError(`${wf.file} (${wf.meta.name}) threw ${name}: ${message}`, state.calls, state.maxInFlight);
  }
  return {
    result: toJson(result),
    calls: state.calls,
    maxInFlight: state.maxInFlight,
    events: state.events,
    logs: state.logs,
    phases: state.phases,
  };
}

/**
 * A responder keyed by the task header (slice 03 §5.1). A key is `<stage>@<concept>`, `<stage>@<lens>` or
 * `<stage>`, tried in that order. Its value is a list of results, used in order, or a function of the call
 * and the 0-based count of earlier calls matched to that key. A call that matches no key, or runs past its
 * list, throws, so an unscripted step fails the test loudly.
 */
export function byStage(table: Record<string, unknown[] | ((call: AgentCall, nth: number) => unknown)>): Responder {
  const used = new Map<string, number>();
  return (call) => {
    const h = call.header ?? {};
    const stage = typeof h.stage === 'string' ? h.stage : '';
    const keys = [`${stage}@${String(h.concept)}`, `${stage}@${String(h.lens)}`, stage];
    const key = keys.find((k) => Object.prototype.hasOwnProperty.call(table, k));
    if (key === undefined) throw new Error(`no scripted result for stage "${stage}" (call ${call.index}); keys: ${Object.keys(table).join(', ')}`);
    const nth = used.get(key) ?? 0;
    used.set(key, nth + 1);
    const entry = table[key];
    if (typeof entry === 'function') return entry(call, nth);
    if (nth >= entry.length) throw new Error(`no scripted result left for "${key}" (call ${call.index}, its ${nth + 1}th)`);
    return entry[nth];
  };
}
