/**
 * Trade errors (C-10). Every trade failure is a `TradeError` whose `kind` says what happened and
 * whose message says what to do. Messages never contain the session cookie, a header value or a
 * network-layer error text (FR-T1).
 */

export type TradeErrorKind =
  | 'no_session'
  | 'session_rejected'
  | 'too_complex'
  | 'invalid_query'
  | 'rate_limited'
  | 'locked_out'
  | 'would_wait'
  | 'auth'
  | 'http'
  | 'network'
  | 'timeout'
  | 'disabled';

/** The server's error message is kept for display only, truncated to this many characters (D-50). */
export const SERVER_MESSAGE_MAX = 300;

export interface TradeErrorDetails {
  status?: number;
  code?: number;
  retryAfterS?: number;
  waitS?: number;
  serverMessage?: string;
}

export class TradeError extends Error {
  readonly kind: TradeErrorKind;
  readonly status?: number;
  readonly code?: number;
  readonly retryAfterS?: number;
  readonly waitS?: number;
  readonly serverMessage?: string;

  constructor(kind: TradeErrorKind, message: string, details: TradeErrorDetails = {}) {
    super(message);
    this.name = 'TradeError';
    this.kind = kind;
    if (details.status !== undefined) this.status = details.status;
    if (details.code !== undefined) this.code = details.code;
    if (details.retryAfterS !== undefined) this.retryAfterS = details.retryAfterS;
    if (details.waitS !== undefined) this.waitS = details.waitS;
    if (details.serverMessage !== undefined) this.serverMessage = truncateServerMessage(details.serverMessage);
  }
}

/** Truncate a server-supplied message for display (never parsed, D-24). */
export function truncateServerMessage(message: string): string {
  return message.length > SERVER_MESSAGE_MAX ? message.slice(0, SERVER_MESSAGE_MAX) : message;
}
