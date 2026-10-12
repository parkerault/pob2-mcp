#!/usr/bin/env node
// A localhost-only OTLP/HTTP (JSON) receiver for Claude Code's telemetry (build-guide WU-64).
//
//   node scripts/otlp-receiver.mjs --out <events.jsonl> [--port 4318]
//
// It binds 127.0.0.1 only and appends one JSON line per kept record to --out:
//   {"kind":"event","name":"api_request","time":...,"attributes":{...}}   from POST /v1/logs
//   {"kind":"metric","name":"claude_code.token.usage","value":...,"temporality":"delta",...}  from /v1/metrics
// Only the api_request and api_error events and the token and cost metrics are kept; every other event
// (prompts, tool results) is dropped unread. Resource attributes are never written, and any attribute
// whose key names an identity (user.*, identity.*, *.email, *account*, organization.*, host.*, terminal.*, ...) or
// whose value looks like an email address is dropped. Traces are accepted and discarded. Claude Code must
// export with OTEL_EXPORTER_OTLP_PROTOCOL=http/json; a protobuf body is refused with 415. Stop with Ctrl-C.
// `node scripts/run-usage.mjs --telemetry <events.jsonl>` totals the file.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const KEEP_EVENTS = new Set(['api_request', 'api_error']);
const KEEP_METRICS = new Set(['claude_code.token.usage', 'claude_code.cost.usage']);
const IDENTITY_TOKENS = new Set([
  'user', 'email', 'account', 'organization', 'org', 'group', 'groups', 'host', 'hostname', 'terminal', 'ip',
  'subscription', 'tagged', 'os', 'login', 'username', 'identity',
]);
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MAX_BODY = 64 * 1024 * 1024;

export function isIdentityKey(key) {
  return key.toLowerCase().split(/[._\-]/).some((t) => IDENTITY_TOKENS.has(t));
}

/** Decode an OTLP JSON AnyValue. */
function anyValue(v) {
  if (v == null || typeof v !== 'object') return v ?? null;
  if ('stringValue' in v) return v.stringValue;
  if ('intValue' in v) return Number(v.intValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('boolValue' in v) return v.boolValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(anyValue);
  if ('kvlistValue' in v) return attributes(v.kvlistValue.values);
  return null;
}

/** Decode a KeyValue list, dropping identity keys and email-like values. */
export function attributes(list) {
  const out = {};
  for (const kv of list || []) {
    if (!kv || typeof kv.key !== 'string' || isIdentityKey(kv.key)) continue;
    const v = anyValue(kv.value);
    if (typeof v === 'string' && EMAIL.test(v)) continue;
    if (v !== null && typeof v === 'object') continue; // no nested values are needed
    out[kv.key] = v;
  }
  return out;
}

const nanosToIso = (n) => (n ? new Date(Number(BigInt(String(n)) / 1000000n)).toISOString() : null);

export function logsToLines(body) {
  const lines = [];
  let dropped = 0;
  for (const rl of body.resourceLogs || []) {
    for (const sl of rl.scopeLogs || []) {
      for (const rec of sl.logRecords || []) {
        const attrs = attributes(rec.attributes);
        const bodyName = typeof rec.body?.stringValue === 'string' ? rec.body.stringValue : '';
        const name = String(attrs['event.name'] || bodyName).replace(/^claude_code\./, '');
        if (!KEEP_EVENTS.has(name)) {
          dropped++;
          continue;
        }
        lines.push({ kind: 'event', name, time: nanosToIso(rec.timeUnixNano || rec.observedTimeUnixNano), attributes: attrs });
      }
    }
  }
  return { lines, dropped };
}

export function metricsToLines(body) {
  const lines = [];
  let dropped = 0;
  for (const rm of body.resourceMetrics || []) {
    for (const sm of rm.scopeMetrics || []) {
      for (const m of sm.metrics || []) {
        const data = m.sum || m.gauge;
        if (!KEEP_METRICS.has(m.name) || !data) {
          dropped++;
          continue;
        }
        const temporality = data.aggregationTemporality === 2 || data.aggregationTemporality === 'AGGREGATION_TEMPORALITY_CUMULATIVE' ? 'cumulative' : 'delta';
        for (const dp of data.dataPoints || []) {
          lines.push({
            kind: 'metric', name: m.name,
            value: Number(dp.asDouble ?? dp.asInt ?? 0),
            temporality,
            start: nanosToIso(dp.startTimeUnixNano), time: nanosToIso(dp.timeUnixNano),
            attributes: attributes(dp.attributes),
          });
        }
      }
    }
  }
  return { lines, dropped };
}

export function startReceiver({ out, port = 4318, host = '127.0.0.1', log = (m) => console.error(m) }) {
  const counts = { events: 0, metrics: 0, dropped: 0, refused: 0 };
  const server = http.createServer((req, res) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(c);
    });
    req.on('end', () => {
      const reply = (code, obj) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (req.method !== 'POST') return reply(405, {});
      const type = String(req.headers['content-type'] || '');
      if (!type.includes('json')) {
        counts.refused++;
        log(`[otlp-receiver] refused a ${type || 'untyped'} body: set OTEL_EXPORTER_OTLP_PROTOCOL=http/json`);
        return reply(415, {});
      }
      let body;
      try {
        let buf = Buffer.concat(chunks);
        if (/gzip/i.test(String(req.headers['content-encoding'] || ''))) buf = zlib.gunzipSync(buf);
        body = JSON.parse(buf.toString('utf8') || '{}');
      } catch (e) {
        log(`[otlp-receiver] unreadable body on ${req.url}: ${e.message}`);
        return reply(400, {});
      }
      let got = { lines: [], dropped: 0 };
      // By body shape, so a bare endpoint path works as well as /v1/logs and /v1/metrics.
      if (Array.isArray(body.resourceLogs)) got = logsToLines(body);
      else if (Array.isArray(body.resourceMetrics)) got = metricsToLines(body);
      if (got.lines.length) fs.appendFileSync(out, got.lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
      for (const l of got.lines) counts[l.kind === 'event' ? 'events' : 'metrics']++;
      counts.dropped += got.dropped;
      return reply(200, {});
    });
  });
  server.listen(port, host, () => log(`[otlp-receiver] listening on http://${host}:${server.address().port}, appending to ${out}`));
  return { server, counts };
}

function main(argv) {
  let out = null;
  let port = 4318;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--port') port = Number(argv[++i]);
    else throw new Error(`unexpected argument: ${argv[i]}`);
  }
  if (!out) {
    console.error('usage: node scripts/otlp-receiver.mjs --out <events.jsonl> [--port 4318]');
    process.exitCode = 2;
    return;
  }
  const { server, counts } = startReceiver({ out, port });
  const timer = setInterval(() => console.error(`[otlp-receiver] kept ${counts.events} events, ${counts.metrics} metric points; dropped ${counts.dropped}`), 60000);
  timer.unref();
  const stop = () => {
    console.error(`[otlp-receiver] stopping: kept ${counts.events} events, ${counts.metrics} metric points; dropped ${counts.dropped}; refused ${counts.refused}`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
