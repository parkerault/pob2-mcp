/**
 * `fixtureFetch(routes)` (C-18): a `fetch` that serves committed fixtures and records every call.
 *
 * - A route matches by RegExp (on the URL) or predicate, and responds with a fixture
 *   (`tests/fixtures/<fixture>.response.json`, status and headers from the sibling
 *   `.headers.json` when present), a literal `{status, headers?, body}`, or a function.
 * - An unmatched URL throws `Error("unmatched fetch: <url>")`.
 * - Aborts are honoured: a pending (including a delayed) response rejects with
 *   `init.signal.reason` when the signal aborts.
 */
import fs from 'fs';
import path from 'path';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

export type FixtureRespond =
  | { fixture: string; delayMs?: number }
  | { status: number; headers?: Record<string, string>; body?: unknown; delayMs?: number }
  | ((url: string, init: RequestInit | undefined) => Response | Promise<Response>);

export interface FixtureRoute {
  match: RegExp | ((url: string, init: RequestInit | undefined) => boolean);
  respond: FixtureRespond;
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as { url?: string } | undefined)?.url ?? String(input);
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init?.headers) return out;
  new Headers(init.headers).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function bodyOf(init: RequestInit | undefined): string | undefined {
  const b = init?.body;
  if (b === undefined || b === null) return undefined;
  return typeof b === 'string' ? b : String(b);
}

function fixtureResponse(name: string): Response {
  const base = path.join(FIXTURES, name);
  const body = fs.readFileSync(`${base}.response.json`, 'utf8');
  let status = 200;
  let headers: Record<string, string> = { 'content-type': 'application/json' };
  if (fs.existsSync(`${base}.headers.json`)) {
    const meta = JSON.parse(fs.readFileSync(`${base}.headers.json`, 'utf8')) as {
      status?: number;
      headers?: Record<string, string>;
    };
    if (typeof meta.status === 'number') status = meta.status;
    if (meta.headers) headers = meta.headers;
  }
  return new Response(body, { status, headers });
}

function literalResponse(r: { status: number; headers?: Record<string, string>; body?: unknown }): Response {
  const body = r.body === undefined ? null : typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  return new Response(body, { status: r.status, headers: r.headers });
}

/** Reject with the signal's reason as soon as it aborts. */
function abortable<T>(work: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fixtureFetch(routes: FixtureRoute[]): { fetch: typeof globalThis.fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const fetchImpl = async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const route = routes.find((r) => (r.match instanceof RegExp ? r.match.test(url) : r.match(url, init)));
    if (!route) throw new Error(`unmatched fetch: ${url}`);
    calls.push({ url, method: (init?.method ?? 'GET').toUpperCase(), headers: headersOf(init), body: bodyOf(init) });

    const respond = route.respond;
    const work = (async (): Promise<Response> => {
      if (typeof respond === 'function') return respond(url, init);
      if (respond.delayMs) await delay(respond.delayMs);
      return 'fixture' in respond ? fixtureResponse(respond.fixture) : literalResponse(respond);
    })();
    return abortable(work, init?.signal);
  };

  return { fetch: fetchImpl as unknown as typeof globalThis.fetch, calls };
}
