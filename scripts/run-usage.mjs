#!/usr/bin/env node
// Per-run token counter over Claude Code session transcripts (build-guide WU-64, D-357).
//
//   node scripts/run-usage.mjs <session.jsonl> [<session.jsonl> …] [--telemetry <events.jsonl>] [--json <out.json>] [--fit]
//   node scripts/run-usage.mjs --telemetry <events.jsonl> [--json <out.json>]
//
// Each <session.jsonl> is a main-session transcript, one per session of the run (a resumed run has several,
// build-guide D-415); the subagent transcripts beside each, in <session>/subagents/*.jsonl, are read too. With
// transcripts, `--telemetry` counts only their sessions' events (the `session.id` attribute; a session's id is its
// transcript entries' `sessionId`, else its file name), since the launcher's telemetry file holds every session
// (D-424). The design steps are also grouped per build, by the task header's `concept` (D-416). Entries are deduplicated per API request (message id, else
// request id) and each request keeps its most complete usage record. Claude Code logs one entry per
// content block; when a request has several blocks, some or all entries can carry the stale
// message_start usage (a 60K-character Write logged at 8 output tokens). A complete record carries
// `output_tokens_details` (thinking tokens) and `iterations`; a request without one is estimated from
// its content (see `estimate`). `--telemetry` joins the OTLP events written by
// scripts/otlp-receiver.mjs, request by request; with no transcript it totals the telemetry alone.
// `--fit` prints the least-squares fit behind the constants in K, over the given transcripts' complete
// records. The output is JSON (`--json`) and a text table on stdout; it holds no paths or identity.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Estimator constants, fitted with `--fit` on run A's 1,271 complete records (WU-64 report). Thinking
 * text is not logged (only its encrypted signature), so thinking tokens are estimated from the signature:
 * a fixed ~890-character envelope per block plus 0.346 tokens per further character. Visible output
 * (text and tool-call input as JSON) is chars / 2.14 plus a per-request, per-tool-call and per-text-block
 * overhead. Each agent then rescales both parts by the ratio its own complete records show (`calibrate`).
 */
export const K = {
  thinkPerSigChar: 0.346,
  sigEnvelope: 890,
  visCharsPerToken: 2.144,
  perRequest: 92,
  perToolCall: 13,
  perTextBlock: 10.5,
  /** An agent's own ratio is used once its complete records predict at least this many tokens. */
  minCalibrationTokens: 2000,
};

const isComplete = (u) => !!u && (u.output_tokens_details != null || Array.isArray(u.iterations));
const n0 = (x) => (Number.isFinite(x) ? x : 0);

function readJsonl(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a torn last line */
    }
  }
  return out;
}

function promptText(entry) {
  const c = entry.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((b) => (b?.type === 'text' ? b.text : '')).join('\n');
  return '';
}

/** The step kind: the brief's `"stage"` marker in the first prompt, else the agent type. */
function stepKind(firstPrompt, meta, isMain) {
  if (isMain) return 'runner';
  const m = /"stage"\s*:\s*"([^"]+)"/.exec(firstPrompt.slice(0, 4000));
  if (m) return m[1];
  return (meta.agentType || 'agent').replace(/^build-guide-/, '');
}

/** D-416: the build a step works for, its task header's `"concept"` (the card id), or null. */
function stepConcept(firstPrompt, isMain) {
  if (isMain) return null;
  return /"concept"\s*:\s*"(r[1-9]\d*-[a-cgx]-[1-9]\d*)"/.exec(firstPrompt.slice(0, 4000))?.[1] ?? null;
}

/** A transcript's session id: its entries' `sessionId`, else its file name without `.jsonl`. */
export function sessionIdOf(file) {
  for (const e of readJsonl(file)) if (typeof e.sessionId === 'string' && e.sessionId !== '') return e.sessionId;
  return path.basename(file, '.jsonl');
}

/** The thinking and visible features of one request's content blocks. */
function features(blocks) {
  const f = { sigChars: 0, thinkFeat: 0, thinkBlocks: 0, visChars: 0, toolCalls: 0, textBlocks: 0 };
  for (const b of blocks) {
    if (b.type === 'thinking' || b.type === 'redacted_thinking') {
      const s = (b.signature || b.data || '').length;
      f.sigChars += s;
      f.thinkBlocks++;
      f.thinkFeat += Math.max(0, s - K.sigEnvelope);
    } else if (b.type === 'text') {
      f.visChars += (b.text || '').length;
      f.textBlocks++;
    } else if (b.type === 'tool_use' || b.type === 'server_tool_use') {
      f.visChars += JSON.stringify(b.input ?? {}).length;
      f.toolCalls++;
    }
  }
  return f;
}

/** The uncalibrated estimate of a request's thinking and visible output. */
function estimate(f) {
  return {
    thinking: K.thinkPerSigChar * f.thinkFeat,
    visible: f.visChars / K.visCharsPerToken + K.perRequest + K.perToolCall * f.toolCalls + K.perTextBlock * f.textBlocks,
  };
}

/** Group one transcript file's assistant entries into requests. */
function readAgentFile(file, meta, isMain) {
  const entries = readJsonl(file);
  const firstUser = entries.find((e) => e.type === 'user' && !e.isMeta);
  const groups = new Map(); // agent key -> Map(request key -> request)
  let costState = null;
  for (const e of entries) {
    if (e.type === 'cost-state') costState = e.modelUsage ?? null;
    if (e.type !== 'assistant' || !e.message) continue;
    const m = e.message;
    if (m.model === '<synthetic>') continue;
    const agentKey = isMain && e.isSidechain && e.agentId ? e.agentId : 'self';
    if (!groups.has(agentKey)) groups.set(agentKey, new Map());
    const reqs = groups.get(agentKey);
    const key = m.id || e.requestId || e.uuid;
    let r = reqs.get(key);
    if (!r) {
      r = { requestId: e.requestId ?? null, model: m.model ?? null, usages: [], blocks: new Map() };
      reqs.set(key, r);
    }
    if (!r.requestId && e.requestId) r.requestId = e.requestId;
    if (m.usage) r.usages.push(m.usage);
    (m.content || []).forEach((b, i) => {
      const bk = e.apiBlockIndex != null ? `${e.apiBlockIndex}` : `${b.type}:${b.id || (b.signature || b.text || '').slice(0, 64) || i}`;
      r.blocks.set(bk, b);
    });
  }
  const agents = [];
  for (const [agentKey, reqs] of groups) {
    const requests = [];
    for (const r of reqs.values()) {
      const complete = r.usages.filter(isComplete);
      const pool = complete.length ? complete : r.usages;
      const u = pool.reduce((a, b) => (n0(b.output_tokens) > n0(a.output_tokens) ? b : a), pool[0] || {});
      const ctx = Math.max(
        0,
        ...r.usages.map((x) => n0(x.input_tokens) + n0(x.cache_read_input_tokens) + n0(x.cache_creation_input_tokens)),
      );
      const f = features([...r.blocks.values()]);
      requests.push({
        requestId: r.requestId,
        model: r.model,
        complete: complete.length > 0,
        recorded: n0(u.output_tokens),
        thinkingRecorded: complete.length ? n0(u.output_tokens_details?.thinking_tokens) : null,
        input: n0(u.input_tokens),
        cacheRead: n0(u.cache_read_input_tokens),
        cacheWrite: n0(u.cache_creation_input_tokens),
        context: ctx,
        f,
        base: estimate(f),
      });
    }
    agents.push({
      agent: isMain && agentKey === 'self' ? 'main' : agentKey === 'self' ? path.basename(file, '.jsonl').replace(/^agent-/, '') : agentKey,
      kind: stepKind(firstUser ? promptText(firstUser) : '', meta, isMain && agentKey === 'self'),
      concept: stepConcept(firstUser ? promptText(firstUser) : '', isMain && agentKey === 'self'),
      description: isMain && agentKey === 'self' ? 'main session' : meta.description || '',
      requests,
    });
  }
  return { agents, costState };
}

/** Each agent's own correction ratios, from its complete records (1 when they are too few). */
function calibrate(records) {
  let tRec = 0, tEst = 0, vRec = 0, vEst = 0;
  for (const r of records) {
    tRec += r.thinkingRecorded;
    tEst += r.base.thinking;
    vRec += r.recorded - r.thinkingRecorded;
    vEst += r.base.visible;
  }
  return {
    think: tEst >= K.minCalibrationTokens ? tRec / tEst : 1,
    visible: vEst >= K.minCalibrationTokens ? vRec / vEst : 1,
  };
}

const predict = (r, k) => ({ thinking: r.base.thinking * k.think, visible: r.base.visible * k.visible });

/** Totals for one agent: recorded, estimated (complete records kept, the rest estimated), and the check. */
function summarizeAgent(a) {
  const reqs = a.requests;
  const comp = reqs.filter((r) => r.complete);
  const k = calibrate(comp);
  const s = {
    agent: a.agent, kind: a.kind, concept: a.concept ?? null, description: a.description,
    turns: reqs.length, completeTurns: comp.length,
    recorded: 0, estimated: 0, thinking: 0, visible: 0,
    input: 0, cacheRead: 0, cacheWrite: 0, peakContext: 0,
    calibration: { think: +k.think.toFixed(3), visible: +k.visible.toFixed(3) },
  };
  for (const r of reqs) {
    s.recorded += r.recorded;
    s.input += r.input;
    s.cacheRead += r.cacheRead;
    s.cacheWrite += r.cacheWrite;
    s.peakContext = Math.max(s.peakContext, r.context);
    if (r.complete) {
      r.estimated = r.recorded;
      r.thinking = r.thinkingRecorded;
    } else {
      const p = predict(r, k);
      r.estimated = Math.max(r.recorded, Math.round(p.thinking + p.visible));
      r.thinking = Math.round(p.thinking);
    }
    s.estimated += r.estimated;
    s.thinking += r.thinking;
  }
  s.visible = s.estimated - s.thinking;
  // The check: hide each complete record and estimate it. Uncalibrated uses K alone; calibrated uses the
  // agent's ratio from its other complete records (two folds by parity), as a missing record would be.
  const folds = [comp.filter((_, i) => i % 2 === 0), comp.filter((_, i) => i % 2 === 1)];
  const ks = [calibrate(folds[1]), calibrate(folds[0])];
  s.check = { records: comp.length, recorded: 0, uncalibrated: 0, calibrated: 0 };
  folds.forEach((fold, i) => {
    for (const r of fold) {
      s.check.recorded += r.recorded;
      s.check.uncalibrated += r.base.thinking + r.base.visible;
      const p = predict(r, ks[i]);
      s.check.calibrated += p.thinking + p.visible;
    }
  });
  s.check.uncalibrated = Math.round(s.check.uncalibrated);
  s.check.calibrated = Math.round(s.check.calibrated);
  return s;
}

const SUM_KEYS = ['turns', 'completeTurns', 'recorded', 'estimated', 'thinking', 'visible', 'input', 'cacheRead', 'cacheWrite'];

function rollup(rows, keyOf) {
  const out = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    if (!out.has(key)) {
      out.set(key, { key, agents: 0, peakContext: 0, check: { records: 0, recorded: 0, uncalibrated: 0, calibrated: 0 } });
      for (const k of SUM_KEYS) out.get(key)[k] = 0;
    }
    const t = out.get(key);
    t.agents++;
    for (const k of SUM_KEYS) t[k] += r[k];
    t.peakContext = Math.max(t.peakContext, r.peakContext);
    for (const k of Object.keys(t.check)) t.check[k] += r.check[k];
  }
  return [...out.values()].sort((a, b) => b.estimated - a.estimated);
}

const errPct = (est, rec) => (rec ? +((100 * (est - rec)) / rec).toFixed(1) : null);
const family = (kind) => kind.split('-')[0];

export function countTranscript(mainFile) {
  const files = [{ file: mainFile, meta: {}, isMain: true }];
  const subDir = path.join(mainFile.replace(/\.jsonl$/, ''), 'subagents');
  if (fs.existsSync(subDir)) {
    for (const f of fs.readdirSync(subDir).filter((x) => x.endsWith('.jsonl')).sort()) {
      const metaPath = path.join(subDir, f.replace(/\.jsonl$/, '.meta.json'));
      const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
      files.push({ file: path.join(subDir, f), meta, isMain: false });
    }
  }
  const agents = [];
  let costState = null;
  for (const { file, meta, isMain } of files) {
    const res = readAgentFile(file, meta, isMain);
    if (isMain) costState = res.costState;
    agents.push(...res.agents);
  }
  return { agents, costState };
}

/** The sessions' cost ledgers (cost-state), summed per model; null when none has one. */
function mergeCostStates(states) {
  const present = states.filter((x) => x && typeof x === 'object');
  if (present.length === 0) return null;
  const out = {};
  for (const st of present) {
    for (const [model, m] of Object.entries(st)) {
      out[model] ??= {};
      for (const [k, v] of Object.entries(m ?? {})) if (Number.isFinite(v)) out[model][k] = (out[model][k] ?? 0) + v;
    }
  }
  return out;
}

/** Least-squares fit of the constants in K over complete records (`--fit`). */
function fit(agents) {
  const rows = agents.flatMap((a) => a.requests.filter((r) => r.complete));
  const solve = (X, y) => {
    const k = X[0].length;
    const M = Array.from({ length: k }, () => Array(k + 1).fill(0));
    X.forEach((x, i) => {
      for (let a = 0; a < k; a++) {
        M[a][k] += x[a] * y[i];
        for (let b = 0; b < k; b++) M[a][b] += x[a] * x[b];
      }
    });
    for (let i = 0; i < k; i++) {
      let p = i;
      for (let j = i + 1; j < k; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
      [M[i], M[p]] = [M[p], M[i]];
      for (let j = 0; j < k; j++) {
        if (j === i) continue;
        const q = M[j][i] / M[i][i];
        for (let c = i; c <= k; c++) M[j][c] -= q * M[i][c];
      }
    }
    return M.map((r, i) => r[k] / r[i]);
  };
  const [a, b] = solve(rows.map((r) => [r.f.sigChars, r.f.thinkBlocks]), rows.map((r) => r.thinkingRecorded));
  const [v, t, x, d] = solve(
    rows.map((r) => [r.f.visChars, r.f.toolCalls, r.f.textBlocks, 1]),
    rows.map((r) => r.recorded - r.thinkingRecorded),
  );
  return {
    records: rows.length,
    thinkPerSigChar: +a.toFixed(4), sigEnvelope: Math.round(-b / a),
    visCharsPerToken: +(1 / v).toFixed(3), perRequest: +d.toFixed(1), perToolCall: +t.toFixed(1), perTextBlock: +x.toFixed(1),
  };
}

// ---------------------------------------------------------------- telemetry (scripts/otlp-receiver.mjs)

/**
 * The telemetry's api_request events and metrics; with `sessions`, only those of the given sessions (their
 * `session.id` attribute, D-424): the launcher's file holds every session it ran.
 */
export function readTelemetry(file, sessions = null) {
  const events = [];
  const metrics = [];
  const ours = (attrs) => sessions === null || sessions.has(attrs?.['session.id']);
  for (const e of readJsonl(file)) {
    if (e.kind === 'event' && e.name === 'api_request' && ours(e.attributes)) events.push(e.attributes || {});
    else if (e.kind === 'metric' && ours(e.attributes)) metrics.push(e);
  }
  return { events, metrics };
}

const num = (x) => (x == null || x === '' ? 0 : Number(x));
const sourceOf = (a) => [a.query_source || '?', a['agent.name'] || ''].filter(Boolean).join(' / ');

function summarizeTelemetry({ events, metrics }) {
  const bySource = new Map();
  const total = { requests: 0, output: 0, input: 0, cacheRead: 0, cacheWrite: 0 };
  for (const a of events) {
    const key = `${sourceOf(a)} | ${a.model || '?'}`;
    if (!bySource.has(key)) bySource.set(key, { key, requests: 0, output: 0, input: 0, cacheRead: 0, cacheWrite: 0 });
    for (const t of [bySource.get(key), total]) {
      t.requests++;
      t.output += num(a.output_tokens);
      t.input += num(a.input_tokens);
      t.cacheRead += num(a.cache_read_tokens);
      t.cacheWrite += num(a.cache_creation_tokens);
    }
  }
  // claude_code.token.usage: delta temporality (Claude Code's default) sums every point; a cumulative
  // series keeps its last point per attribute set.
  const metricTotals = {};
  const cumulative = new Map();
  for (const m of metrics) {
    if (m.name !== 'claude_code.token.usage') continue;
    const type = m.attributes?.type || '?';
    const src = sourceOf(m.attributes || {});
    const key = `${type} | ${src}`;
    if (m.temporality === 'cumulative') cumulative.set(`${key} | ${JSON.stringify(m.attributes)} | ${m.start}`, { key, value: num(m.value) });
    else metricTotals[key] = (metricTotals[key] || 0) + num(m.value);
  }
  for (const { key, value } of cumulative.values()) metricTotals[key] = (metricTotals[key] || 0) + value;
  return { total, bySource: [...bySource.values()].sort((a, b) => b.output - a.output), tokenMetric: metricTotals };
}

/** Request-by-request join of the transcript counter with the telemetry's api_request events. */
function joinTelemetry(agents, events) {
  const tel = new Map();
  for (const a of events) if (a.request_id) tel.set(a.request_id, a);
  const seen = new Set();
  const j = {
    matched: 0, transcriptOnly: 0,
    complete: { n: 0, exact: 0, recorded: 0, telemetry: 0 },
    stale: { n: 0, recorded: 0, estimated: 0, telemetry: 0, requests: [] },
    perAgent: [],
    telemetryOnly: { requests: 0, output: 0, bySource: {} },
  };
  for (const a of agents) {
    const pa = { agent: a.agent, kind: a.kind, matched: 0, estimated: 0, telemetry: 0 };
    for (const r of a.requests) {
      const t = r.requestId ? tel.get(r.requestId) : null;
      if (!t) {
        j.transcriptOnly++;
        continue;
      }
      seen.add(r.requestId);
      j.matched++;
      const out = num(t.output_tokens);
      pa.matched++;
      pa.estimated += r.estimated;
      pa.telemetry += out;
      if (r.complete) {
        j.complete.n++;
        if (out === r.recorded) j.complete.exact++;
        j.complete.recorded += r.recorded;
        j.complete.telemetry += out;
      } else {
        j.stale.n++;
        j.stale.recorded += r.recorded;
        j.stale.estimated += r.estimated;
        j.stale.telemetry += out;
        j.stale.requests.push({ agent: a.agent, kind: a.kind, recorded: r.recorded, estimated: r.estimated, telemetry: out });
      }
    }
    if (pa.matched) j.perAgent.push(pa);
  }
  for (const [id, a] of tel) {
    if (seen.has(id)) continue;
    j.telemetryOnly.requests++;
    j.telemetryOnly.output += num(a.output_tokens);
    const s = sourceOf(a);
    j.telemetryOnly.bySource[s] = (j.telemetryOnly.bySource[s] || 0) + num(a.output_tokens);
  }
  return j;
}

// ---------------------------------------------------------------- output

const fmtK = (x) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : `${(x / 1e3).toFixed(1)}K`);
const pad = (s, w, right) => (right ? String(s).padStart(w) : String(s).padEnd(w));

function table(title, rows, label) {
  const lines = [title];
  lines.push(
    [pad(label, 34), pad('kind', 13), pad('turns', 6, 1), pad('cmpl', 5, 1), pad('recorded', 9, 1), pad('estimated', 10, 1),
      pad('thinking', 9, 1), pad('visible', 9, 1), pad('cacheRd', 9, 1), pad('cacheWr', 8, 1), pad('peak', 7, 1), pad('chk%', 6, 1)].join(' '),
  );
  for (const r of rows) {
    lines.push(
      [pad(String(r.label).slice(0, 34), 34), pad(String(r.kind ?? '').slice(0, 13), 13), pad(r.turns, 6, 1),
        pad(`${Math.round((100 * r.completeTurns) / Math.max(1, r.turns))}%`, 5, 1), pad(fmtK(r.recorded), 9, 1),
        pad(fmtK(r.estimated), 10, 1), pad(fmtK(r.thinking), 9, 1), pad(fmtK(r.visible), 9, 1), pad(fmtK(r.cacheRead), 9, 1),
        pad(fmtK(r.cacheWrite), 8, 1), pad(fmtK(r.peakContext), 7, 1), pad(errPct(r.check.calibrated, r.check.recorded) ?? '-', 6, 1)].join(' '),
    );
  }
  return lines.join('\n');
}

function main(argv) {
  const opts = { transcripts: [], telemetry: null, json: null, fit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--telemetry') opts.telemetry = argv[++i];
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--fit') opts.fit = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) throw new Error(`unexpected argument: ${a}`);
    else opts.transcripts.push(a);
  }
  if (opts.help || (opts.transcripts.length === 0 && !opts.telemetry)) {
    console.log('usage: node scripts/run-usage.mjs <session.jsonl> [<session.jsonl> …] [--telemetry <events.jsonl>] [--json <out.json>] [--fit]');
    return opts.help ? 0 : 2;
  }
  const result = { constants: K };
  const text = [];
  let agents = [];
  // D-415, D-424: one transcript per session of the run; the telemetry is filtered to their sessions.
  const sessions = opts.transcripts.length > 0 ? new Set(opts.transcripts.map(sessionIdOf)) : null;
  if (opts.transcripts.length > 0) {
    const all = opts.transcripts.map(countTranscript);
    const counted = { agents: all.flatMap((c) => c.agents), costState: mergeCostStates(all.map((c) => c.costState)) };
    agents = counted.agents;
    result.sessions = sessions.size;
    if (opts.fit) {
      result.fit = fit(agents);
      text.push(`fit over ${result.fit.records} complete records: ${JSON.stringify(result.fit)}`);
    }
    const rows = agents.map(summarizeAgent).sort((a, b) => b.estimated - a.estimated);
    const kinds = rollup(rows, (r) => r.kind);
    const families = rollup(rows, (r) => family(r.kind));
    const [total] = rollup(rows, () => 'total');
    // D-416: per build, the steps whose task header names its card (`concept`).
    const builds = rollup(rows.filter((r) => r.concept !== null), (r) => r.concept);
    for (const t of [...kinds, ...families, ...builds, total]) {
      t.check.uncalibratedErrPct = errPct(t.check.uncalibrated, t.check.recorded);
      t.check.calibratedErrPct = errPct(t.check.calibrated, t.check.recorded);
    }
    Object.assign(result, { agents: rows, kinds, families, builds, total, sessionLedger: counted.costState });
    text.push(table('Per agent', rows.map((r) => ({ ...r, label: r.description || r.agent })), 'agent'));
    text.push(table('\nPer step kind', kinds.map((r) => ({ ...r, label: `${r.key} (${r.agents})`, kind: '' })), 'kind (agents)'));
    text.push(table('\nPer family', families.map((r) => ({ ...r, label: `${r.key} (${r.agents})`, kind: '' })), 'family (agents)'));
    if (builds.length > 0) text.push(table('\nPer build (the task header\'s concept)', builds.map((r) => ({ ...r, label: `${r.key} (${r.agents})`, kind: '' })), 'build (agents)'));
    text.push(table('\nTotal', [{ ...total, label: `total (${total.agents} agents)`, kind: '' }], ''));
    text.push(
      `\ncheck over ${total.check.records} complete records: recorded ${fmtK(total.check.recorded)}; estimate, K only ` +
        `${fmtK(total.check.uncalibrated)} (${total.check.uncalibratedErrPct}%); per-agent calibrated ` +
        `${fmtK(total.check.calibrated)} (${total.check.calibratedErrPct}%)`,
    );
    if (counted.costState) {
      const out = Object.values(counted.costState).reduce((s, m) => s + n0(m.outputTokens), 0);
      text.push(`session ledger (cost-state, as /cost): output ${fmtK(out)}`);
    }
  }
  if (opts.telemetry) {
    const tel = readTelemetry(opts.telemetry, sessions);
    result.telemetry = summarizeTelemetry(tel);
    const t = result.telemetry;
    text.push(`\nTelemetry${sessions ? ` (the ${sessions.size} session${sessions.size === 1 ? '' : 's'} given)` : ''}: ${t.total.requests} api_request events, output ${fmtK(t.total.output)}, cache read ${fmtK(t.total.cacheRead)}`);
    for (const s of t.bySource) text.push(`  ${pad(s.key, 60)} ${pad(s.requests, 5, 1)} req  output ${pad(fmtK(s.output), 8, 1)}`);
    for (const [k, v] of Object.entries(t.tokenMetric)) text.push(`  token.usage ${pad(k, 50)} ${pad(fmtK(v), 9, 1)}`);
    if (agents.length) {
      const j = joinTelemetry(agents, tel.events);
      result.join = j;
      text.push(
        `Join by request id: ${j.matched} matched, ${j.transcriptOnly} only in the transcripts, ${j.telemetryOnly.requests} only in telemetry (output ${fmtK(j.telemetryOnly.output)})`,
        `  complete records: ${j.complete.exact}/${j.complete.n} exact; recorded ${fmtK(j.complete.recorded)} vs telemetry ${fmtK(j.complete.telemetry)}`,
        `  stale records: recorded ${fmtK(j.stale.recorded)}, estimated ${fmtK(j.stale.estimated)} vs telemetry ${fmtK(j.stale.telemetry)} (${errPct(j.stale.estimated, j.stale.telemetry)}%)`,
      );
      const errs = j.stale.requests.filter((r) => r.telemetry > 0).map((r) => (100 * (r.estimated - r.telemetry)) / r.telemetry).sort((a, b) => a - b);
      if (errs.length) {
        const q = (p) => +errs[Math.min(errs.length - 1, Math.floor(p * errs.length))].toFixed(1);
        const absErr = j.stale.requests.reduce((s, r) => s + Math.abs(r.estimated - r.telemetry), 0);
        j.stale.errorPct = { p5: q(0.05), p25: q(0.25), median: q(0.5), p75: q(0.75), p95: q(0.95), tokenWeightedAbs: +((100 * absErr) / j.stale.telemetry).toFixed(1) };
        const e = j.stale.errorPct;
        text.push(`  stale per request, error %: p5 ${e.p5}, p25 ${e.p25}, median ${e.median}, p75 ${e.p75}, p95 ${e.p95}; token-weighted |error| ${e.tokenWeightedAbs}%`);
      }
      const ledger = result.sessionLedger && Object.values(result.sessionLedger).reduce((s, m) => s + n0(m.outputTokens), 0);
      if (ledger) text.push(`  session ledger output ${fmtK(ledger)} vs telemetry ${fmtK(t.total.output)} (${errPct(ledger, t.total.output)}%)`);
    }
  }
  if (opts.json) fs.writeFileSync(opts.json, `${JSON.stringify(result, null, 2)}\n`);
  console.log(text.join('\n'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
