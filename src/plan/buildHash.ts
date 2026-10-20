/**
 * D-266: the plan's build-affecting projection and its sha1, the compile record's `buildSha1` (C-33). The
 * projection is the plan with every `stages[].claims`, every `source` and `tag` field (at any depth) and,
 * since D-352, the plan's `ledger` removed, serialized canonically: object keys sorted, arrays in order, no
 * whitespace. A claims-only edit in the fix round (D-264: a claim's wording, citation, caveat or source) and
 * a ledger-only edit (D-352: an entry's claim, formula or inputs, an entry added or removed; the run checker
 * re-evaluates the plan's current ledger itself) leave it unchanged; a change to an item, a gem, the tree, the
 * config or a price changes it. D-386: a price's `note` is its wording only, so it is left out too: a note-only
 * fix (the Varashta run's) needs no recompile, no gate and no new PoB file. D-418 (schema 6): a tree need's `claim`,
 * the id of the claim saying why the tree keeps its nodes, is a citation, so it is left out as well: D1-finish sets it
 * after D1-tree with no recompile. A need's `nodes` and `stat` stay in, since the D1 gate's tree verdict keeps them,
 * so changing them recompiles and re-runs the gate.
 *
 * The compiler writes it beside `planSha1`, and the build-guide run checker loads this module's compiled form
 * (`build/plan/buildHash.js`) to hold a plan edited after the final compile to it. It imports only
 * `crypto`, so it loads on its own.
 */
import crypto from 'crypto';

/** The fields a claims-only edit may change anywhere in the plan: a claim's source and a value's source tag. */
const SOURCE_KEYS = new Set(['source', 'tag']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The plan's top-level fields that aren't build content: the ledger (D-352). */
const NON_BUILD_KEYS = new Set(['ledger']);

/** A price's fields that are wording only (D-386): its note. */
const PRICE_TEXT_KEYS = new Set(['note']);

/** A tree need's fields that are citations (D-418): the id of its reason claim. */
const NEED_CITATION_KEYS = new Set(['claim']);

/** A stage's tree without each need's `claim` (D-418); anything else as it is. */
function withoutNeedClaims(tree: unknown): unknown {
  if (!isRecord(tree) || !Array.isArray(tree.needs)) return tree;
  return {
    ...tree,
    needs: tree.needs.map((n) => {
      if (!isRecord(n)) return n;
      const rest = { ...n };
      for (const k of NEED_CITATION_KEYS) delete rest[k];
      return rest;
    }),
  };
}

/**
 * The plan without `ledger`, without `stages[].claims`, without any `source` or `tag` field, without each
 * price's `note` (D-386) and without each tree need's `claim` (D-418).
 */
export function buildProjection(plan: unknown): unknown {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (!isRecord(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (!SOURCE_KEYS.has(k)) out[k] = strip(x);
    return out;
  };
  const projected = strip(plan);
  if (isRecord(projected)) for (const k of NON_BUILD_KEYS) delete projected[k];
  if (isRecord(projected) && Array.isArray(projected.prices)) {
    projected.prices = projected.prices.map((p) => {
      if (!isRecord(p)) return p;
      const rest = { ...p };
      for (const k of PRICE_TEXT_KEYS) delete rest[k];
      return rest;
    });
  }
  if (isRecord(projected) && Array.isArray(projected.stages)) {
    projected.stages = projected.stages.map((s) => {
      if (!isRecord(s)) return s;
      const rest = { ...s };
      delete rest.claims;
      if ('tree' in rest) rest.tree = withoutNeedClaims(rest.tree);
      return rest;
    });
  }
  return projected;
}

/** JSON with every object's keys sorted and no whitespace, so equal values serialize alike. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (isRecord(v)) {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** D-266: the sha1 of the plan's build-affecting projection, as the compile record's `buildSha1`. */
export function buildSha1(plan: unknown): string {
  return crypto.createHash('sha1').update(canonicalJson(buildProjection(plan))).digest('hex');
}
