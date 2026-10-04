/**
 * Trade stat catalogue (`/data/stats`), searchable by text or id.
 *
 * Live stats only: the catalogue is loaded lazily from trade2 the first time a trade tool needs it
 * (D-14). There is no static fallback; until a load succeeds `isLoaded()` is false and
 * `search_stats` reports that trade stat data is unavailable.
 */
import type { StatData } from '../types/tradeTypes.js';

export interface StatMapping {
  /** The trade stat id, e.g. `explicit.stat_3299347043`. */
  tradeId: string;
  /** The stat text, e.g. `# to maximum Life`. */
  text: string;
  /** The `/data/stats` group label, e.g. `Explicit`, `Pseudo`, `Augment`. */
  category: string;
}

export class StatMapper {
  private stats: StatMapping[] = [];
  private byId = new Map<string, StatMapping>();
  private liveLoaded = false;
  private liveLoading: Promise<void> | null = null;

  /** Has the live catalogue been loaded? */
  isLoaded(): boolean {
    return this.liveLoaded;
  }

  /**
   * Lazy-loading hook (D-14): load the live trade2 stats through `load` the first time a trade
   * tool needs them. Concurrent callers share one load; only a successful load is remembered, so a
   * failed one is retried by the next call.
   */
  ensureLoaded(load: () => Promise<unknown>): Promise<void> {
    if (this.liveLoaded) return Promise.resolve();
    if (!this.liveLoading) {
      this.liveLoading = (async () => {
        try {
          this.loadFromTradeAPI((await load()) as StatData);
          this.liveLoaded = true;
        } finally {
          this.liveLoading = null;
        }
      })();
    }
    return this.liveLoading;
  }

  /** Index a `/data/stats` response. */
  loadFromTradeAPI(statData: StatData): void {
    const stats: StatMapping[] = [];
    const byId = new Map<string, StatMapping>();
    for (const group of Array.isArray(statData?.result) ? statData.result : []) {
      for (const entry of Array.isArray(group?.entries) ? group.entries : []) {
        if (typeof entry?.id !== 'string' || typeof entry.text !== 'string') continue;
        const mapping: StatMapping = { tradeId: entry.id, text: entry.text, category: String(group.label ?? '') };
        stats.push(mapping);
        if (!byId.has(entry.id)) byId.set(entry.id, mapping);
      }
    }
    this.stats = stats;
    this.byId = byId;
    console.error(`[StatMapper] Loaded ${stats.length} stats from the trade site`);
  }

  /** The stat with this trade id, or null. */
  getById(tradeId: string): StatMapping | null {
    return this.byId.get(tradeId) ?? null;
  }

  /**
   * Stats matching a query, best first: an exact id or text match, then text containing the
   * whole query, then partial word matches. Ties prefer the shorter (more specific) text, then
   * catalogue order.
   */
  fuzzySearch(query: string, limit: number = 10): StatMapping[] {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    const words = q.split(/\s+/);
    const scored: Array<{ mapping: StatMapping; score: number; index: number }> = [];
    this.stats.forEach((mapping, index) => {
      const id = mapping.tradeId.toLowerCase();
      const text = mapping.text.toLowerCase();
      const bare = text.replace(/[+#%]/g, '').replace(/\s+/g, ' ').trim();
      let score = 0;
      if (id === q) score = 100;
      else if (text === q || bare === q) score = 95;
      else if (text.includes(q)) score = 80;
      else if (id.includes(q)) score = 70;
      else {
        const textWords = text.split(/\s+/);
        const hits = words.filter((w) => textWords.some((t) => t.includes(w))).length;
        if (hits > 0) score = (hits / words.length) * 60;
      }
      if (score > 0) scored.push({ mapping, score, index });
    });
    scored.sort(
      (a, b) => b.score - a.score || a.mapping.text.length - b.mapping.text.length || a.index - b.index,
    );
    return scored.slice(0, Math.max(0, limit)).map((s) => s.mapping);
  }
}
