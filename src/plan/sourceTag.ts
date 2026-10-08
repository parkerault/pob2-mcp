/**
 * C-30 source tags and claim citations (slice 2 §3.2).
 *
 * Every claim in a plan carries a source tag `{kind, ref, accessed?, patch?, confidence?}` (D-105), or
 * cites instead a ledger entry (`ledger:<id>`), a price entry (`price:<id>`, D-237) or a C1/E1 fact
 * (`data:<file>#<key>`, `<file>` relative to `data/`, D-232). This module checks a tag's own shape; the
 * cross-references (that a cited ledger or price id exists, that a `data:` fact resolves) are the plan
 * schema's refinements.
 */
import { z } from 'zod';
import { isMultiSegmentRef } from './ledger.js';

export const SOURCE_KINDS = ['pob-computed', 'pob-data', 'external', 'judgment', 'external-unavailable'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** The one `ref` an `external-unavailable` tag may carry (C-30, D-201). */
export const EXTERNAL_UNAVAILABLE_REF = 'external source unavailable (offline run)';

/** The kinds whose tags must state a confidence: PoB can't verify them. */
const NEEDS_CONFIDENCE: readonly SourceKind[] = ['external', 'judgment', 'external-unavailable'];

/** Whether `s` is a real calendar date written `YYYY-MM-DD`. */
export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** A `YYYY-MM-DD` date string. */
export const isoDateSchema = z.string().refine(isIsoDate, { message: 'must be a date written YYYY-MM-DD' });

function isHttpUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A C-30 source tag. Strict: an unknown key is an error. */
export const sourceTagSchema = z
  .object({
    kind: z.enum(SOURCE_KINDS),
    ref: z.string().min(1, { message: 'ref must not be empty' }),
    accessed: isoDateSchema.optional(),
    patch: z.string().min(1, { message: 'patch must not be empty' }).optional(),
    confidence: z.enum(['H', 'M', 'L']).optional(),
  })
  .strict()
  .superRefine((tag, ctx) => {
    if (tag.kind === 'pob-computed' && tag.ref !== '' && !isMultiSegmentRef(tag.ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ref'],
        message: `a pob-computed ref names a compile-record field as <stageId>.<Field> or <stageId>.g<group>s<skill>p<statSet>.<Field>; got "${tag.ref}"`,
      });
    }
    if (tag.kind === 'external' && tag.ref !== '' && !isHttpUrl(tag.ref)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ref'], message: `an external ref is an http(s) URL; got "${tag.ref}"` });
    }
    if (tag.kind === 'external-unavailable' && tag.ref !== EXTERNAL_UNAVAILABLE_REF) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ref'],
        message: `an external-unavailable ref is exactly "${EXTERNAL_UNAVAILABLE_REF}"`,
      });
    }
    if (tag.kind === 'external' && tag.accessed === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accessed'], message: 'an external tag needs accessed (YYYY-MM-DD)' });
    }
    if (NEEDS_CONFIDENCE.includes(tag.kind) && tag.confidence === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confidence'],
        message: `a tag of kind ${tag.kind} needs confidence (H, M or L)`,
      });
    }
  });

export type SourceTag = z.infer<typeof sourceTagSchema>;

/** A claim citation written as a string instead of a tag. */
export type Citation =
  | { kind: 'ledger'; id: string }
  | { kind: 'price'; id: string }
  | { kind: 'data'; file: string; key: string };

const CITATION_RE = /^(?:(ledger|price):(\S+)|data:([^#\s]+)#(\S+))$/;

/** Parse `ledger:<id>`, `price:<id>` or `data:<file>#<key>`; null for anything else. */
export function parseCitation(s: string): Citation | null {
  const m = CITATION_RE.exec(s);
  if (!m) return null;
  if (m[1] === 'ledger' || m[1] === 'price') return { kind: m[1], id: m[2] };
  return { kind: 'data', file: m[3], key: m[4] };
}

/** A citation string: `ledger:<id>`, `price:<id>` or `data:<file>#<key>`. */
export const citationSchema = z.string().regex(CITATION_RE, {
  message: 'a claim cites a source tag object, or a string ledger:<id>, price:<id> or data:<file>#<key>',
});

/** A claim's `source`: a tag, or a citation string. */
export const claimSourceSchema = z.union([sourceTagSchema, citationSchema]);
