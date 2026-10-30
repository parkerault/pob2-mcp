/**
 * `find_upgrades` output (C-14 "Output", "Fallback result"; D-49, D-53).
 *
 * - **Fallback** (a result, not `isError`): `Trade search not run: <reason>.`, the hint, the pace line (D-474), then
 *   the trade-site link for the generated query.
 * - **Success:** a header (with C-49's `League:` and `Checked:` lines, D-372), this call's notices, the
 *   current item and baseline, the counts line, then the selected listings in rank order. Listings render in full (score, stat deltas, a `Buy:` line,
 *   the PoB item text) while the whole output stays ≤ 30,000 characters; the rest render as one
 *   compact line each, ending with the listing's `Buy:` (D-90), followed by a note. The last line is always `Search on the trade site: <url>` (C-14),
 *   and the line before it the server's pace line (D-474), both inside the budget.
 *   The session's notices go in front of this text (the router adds them, C-3 step 8), so the renderer
 *   is given their length and keeps the whole output, notices included, within the budget.
 */
import { formatCurrencyValue } from './currency.js';
import { exactItemUrl } from './links.js';
import type { ListingRow } from './rankUpgrades.js';

/** D-53: the output budget. */
export const OUTPUT_BUDGET = 30_000;

export const NO_UPGRADE = 'No upgrade within budget.';
export const NO_MATCHES = 'No listings matched the search.';

export const LINK_INTRO = 'Open this search in a browser where you are logged in to pathofexile.com:';
/** The success report's last line's start (C-14: the search link stays last). */
const SEARCH_LINK = 'Search on the trade site: ';

/**
 * D-474: `text` with the server's pace line just before its search link, which C-14 keeps last: before a closing
 * `LINK_INTRO` and link pair (a fallback, or an error that carries the link), or before a last `Search on the trade
 * site:` line; with no link, the pace line is the last line.
 */
export function withPaceBeforeLink(text: string, paceLine: string): string {
  const lines = text.replace(/\n+$/, '').split('\n');
  const n = lines.length;
  if (n >= 2 && lines[n - 2] === LINK_INTRO) lines.splice(n - 2, 0, paceLine);
  else if (lines[n - 1].startsWith(SEARCH_LINK)) lines.splice(n - 1, 0, paceLine);
  else lines.push(paceLine);
  return lines.join('\n');
}

/** PoB's trade statuses and the trader pane's labels (`Trade.lua`, C-15). */
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  securable: 'Instant buyout',
  available: 'Instant buyout and in person',
  onlineleague: 'In person (online in league)',
  online: 'In person (online)',
  any: 'Any (includes offline)',
};

/** `YYYY-MM-DDTHH:MM:SSZ`: the UTC time, in whole seconds (C-49's `Checked:` line, every trade tool's). */
export function checkedTimestamp(epochMs: number): string {
  return new Date(Math.floor(epochMs / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------------------------------
// Fallback

export function renderFallback(f: { reason: string; hint: string; link: string; notes: string[] }, paceLine?: string): string {
  const reason = f.reason.replace(/\.+$/, '');
  return [`Trade search not run: ${reason}.`, f.hint, ...f.notes, ...(paceLine ? [paceLine] : []), LINK_INTRO, f.link].join('\n');
}

// ---------------------------------------------------------------------------------------------------
// Success

export interface UpgradeReport {
  slot: string;
  build: { displayName: string; path: string | null } | null;
  league: string;
  /**
   * The wall-clock time (epoch ms) the call sent its first trade search, or made the report when it sent
   * none: the `Checked:` line that dates its prices (C-49, D-372).
   */
  checkedAt: number;
  status: string;
  /** e.g. `200 exalted`, or null for no budget. */
  budget: string | null;
  sort: Array<{ stat: string; label: string; weight: number }>;
  reportStats: string[];
  /** This call's notices, one per line. */
  notices: string[];
  /** The slot's equipped item, `empty`, or `unknown`. */
  currentItem: string;
  baselineScore: number;
  counts: {
    searches: number;
    total: number;
    fetched: number;
    unavailable: number;
    evaluated: number;
    rejected: number;
    overBudget: number;
    upgrades: number;
  };
  /** The selected listings, in rank order. */
  listings: ListingRow[];
  /** The display currency (C-14 step 11). */
  display: string;
  /** The last query sent (kept for callers; the exact-item links no longer use it, D-90). */
  query: object;
  /** The closing statement before the search link (no upgrade, no matches, all rejected…), if any; may span lines. */
  closing: string | null;
  /** D-474: the server's pace line, just before the search link. */
  paceLine?: string;
  searchUrl: string;
}

/** Up to 2 decimals, no trailing zeros, with an explicit sign. */
function signed(n: number): string {
  const v = Number(n.toFixed(2));
  return `${v >= 0 ? '+' : ''}${v}`;
}

function pctText(pct: number | null | undefined): string {
  return typeof pct === 'number' && Number.isFinite(pct) ? ` (${signed(pct)}%)` : '';
}

function title(row: ListingRow): string {
  const name = row.name || row.baseType || 'Unnamed item';
  return row.baseType && row.baseType !== name ? `${name}, ${row.baseType}` : name;
}

function priceText(row: ListingRow, display: string): string {
  if (!row.price) return 'no price';
  const native = `${row.price.amount} ${row.price.currency}`;
  if (row.normalized !== null) return `${native} (≈ ${formatCurrencyValue(row.normalized)} ${display})`;
  return row.priceNotConverted ? `${native} (price not converted)` : native;
}

const flag = (row: ListingRow) => (row.isUpgrade ? 'UPGRADE' : 'not an upgrade');

/** The item's own name from the fetched entry (`ListingRow.name` falls back to the type line). */
function itemName(row: ListingRow): string {
  const item = (row.entry as unknown as { item?: { name?: unknown } } | null)?.item;
  return typeof item?.name === 'string' ? item.name.trim() : '';
}

/** `Buy: <whisper>`, else the D-90 exact-item link, else (no seller to pin it to) the search itself. */
function buyLine(row: ListingRow, report: UpgradeReport): string {
  if (row.whisper) return `Buy: ${row.whisper}`;
  if (row.account) {
    const link = exactItemUrl(report.league, {
      status: report.status,
      name: itemName(row),
      baseType: row.baseType,
      account: row.account,
      price: row.price,
    });
    return `Buy: ${link}`;
  }
  return `Buy: ${report.searchUrl}`;
}

/** One listing in full (C-14 output). */
export function fullListing(row: ListingRow, n: number, report: UpgradeReport): string {
  const b = report.baselineScore;
  const scorePct = b !== 0 ? ` (${signed(((row.score - b) / Math.abs(b)) * 100)}%)` : '';
  const labels = new Map(report.sort.map((s) => [s.stat, s.label]));
  const order = [...report.sort.map((s) => s.stat), ...report.reportStats.filter((s) => !labels.has(s))];
  const stats = order
    .filter((stat, i) => order.indexOf(stat) === i && row.stats[stat] !== undefined)
    .map((stat) => {
      const d = row.stats[stat];
      const delta = typeof d.delta === 'number' && Number.isFinite(d.delta) ? signed(d.delta) : 'n/a';
      return `${labels.get(stat) ?? stat} ${delta}${pctText(d.pct)}`;
    });
  const lines = [
    `${n}. ${title(row)}: ${priceText(row, report.display)} · ${flag(row)}`,
    `   Score ${row.score.toFixed(4)} vs ${b.toFixed(4)}${scorePct}`,
  ];
  if (stats.length > 0) lines.push(`   ${stats.join(' · ')}`);
  lines.push(`   ${buyLine(row, report)}`, '   Item text:');
  for (const line of row.itemText.split(/\r?\n/)) lines.push(`   ${line}`);
  return lines.join('\n');
}

/**
 * One listing as a compact line (D-53), ending with ` · Buy: <whisper or link>` (D-90) unless `withBuy`
 * is false (only when even the compact lines with their `Buy:` would not fit the budget).
 */
export function compactListing(row: ListingRow, n: number, report: UpgradeReport, withBuy = true): string {
  const line = `${n}. ${title(row)}: ${priceText(row, report.display)} · score ${row.score.toFixed(4)} · ${flag(row)} · seller ${row.account ?? 'unknown'}`;
  return withBuy ? `${line} · ${buyLine(row, report)}` : line;
}

function compactionNote(count: number): string {
  return (
    `${count} listing${count === 1 ? ' is' : 's are'} shown compactly to keep this output under ` +
    `${OUTPUT_BUDGET.toLocaleString('en-US')} characters; ask for a smaller limit to see them in full.`
  );
}

function headLines(report: UpgradeReport): string[] {
  const build = report.build
    ? `Build: ${report.build.displayName} (${report.build.path ?? 'not saved to a file'})`
    : 'Build: none loaded';
  const sort = report.sort.map((s) => `${s.label} ×${s.weight}`).join(', ');
  const c = report.counts;
  return [
    `=== find_upgrades: ${report.slot} ===`,
    build,
    // C-49's two lines, as get_item_price and search_trade_items print them (D-372).
    `League: ${report.league}`,
    `Checked: ${checkedTimestamp(report.checkedAt)}`,
    `${STATUS_LABELS[report.status] ?? report.status} · Budget: ${report.budget ?? 'no budget'} · Sort: ${sort}`,
    ...report.notices,
    `Current item: ${report.currentItem} · Baseline score ${report.baselineScore.toFixed(4)}`,
    `Searches ${c.searches} · Matches ${c.total} · Fetched ${c.fetched} · Unavailable ${c.unavailable} · ` +
      `Evaluated ${c.evaluated} · Rejected ${c.rejected} · Over budget ${c.overBudget} · Upgrades ${c.upgrades}`,
  ];
}

/**
 * The success output under the D-53 budget: listings in full while the next full listing still fits
 * (with every remaining listing compacted after it), the rest compact, with a note. Should the compact
 * lines with their `Buy:` still not fit (whispers or links far longer than the trade site's), the last
 * ones drop their `Buy:` until the output fits.
 *
 * `reservedChars` is the room the text placed in front of this output takes (the session's notices
 * and their blank line, which the router prepends), so that the whole output stays within the budget.
 */
export function renderUpgradeReport(report: UpgradeReport, reservedChars = 0): string {
  const budget = OUTPUT_BUDGET - Math.max(0, reservedChars);
  const head = headLines(report).join('\n');
  const tail = [
    ...(report.closing ? [report.closing] : []),
    ...(report.paceLine ? [report.paceLine] : []),
    `${SEARCH_LINK}${report.searchUrl}`,
  ].join('\n');
  const full = report.listings.map((row, i) => fullListing(row, i + 1, report));
  const compact = report.listings.map((row, i) => compactListing(row, i + 1, report));
  const bare = report.listings.map((row, i) => compactListing(row, i + 1, report, false));
  /** How many of the last compact lines go without their `Buy:`. */
  let buyless = 0;

  const assemble = (k: number): string => {
    const parts = [head];
    const body: string[] = [];
    if (k > 0) body.push(full.slice(0, k).join('\n\n'));
    if (k < compact.length) {
      const cut = compact.length - buyless;
      const lines = compact.map((line, i) => (i >= cut ? bare[i] : line)).slice(k);
      body.push([...lines, compactionNote(compact.length - k)].join('\n'));
    }
    if (body.length > 0) parts.push(body.join('\n\n'));
    parts.push(tail);
    return parts.join('\n\n');
  };

  let k = 0;
  while (k < full.length && assemble(k + 1).length <= budget) k += 1;
  while (buyless < compact.length - k && assemble(k).length > budget) buyless += 1;
  return assemble(k);
}
