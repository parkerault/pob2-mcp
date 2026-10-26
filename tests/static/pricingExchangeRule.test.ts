/**
 * D-444 (amendment 11 §12, WU-112): the skill's pricing rule and `get_item_price`'s description say that whatever the
 * currency exchange sells is priced from poe.ninja's exchange, and the trade site prices only the rest.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { getTradeToolSchemas } from '../../src/server/toolSchemas';

const REPO = path.resolve(__dirname, '..', '..');
const folded = (text: string) => text.replace(/\s*\n\s*/g, ' ');
const pricing = () => folded(fs.readFileSync(path.join(REPO, '.claude', 'skills', 'build-guide', 'references', 'pricing.md'), 'utf8'));

describe('D-444: exchange items from poe.ninja; the trade site for the rest', () => {
  it("pricing.md's tool list names the rule: exchange items by category from poe.ninja, the rest from trade listings", () => {
    const text = pricing();
    expect(text).toContain(
      '- `mcp__pob2__get_item_price`: one item by name. Exchange items from poe.ninja; the trade site for the rest (D-444): whatever the currency exchange sells, by PoB\'s name (runes, soul cores, idols, Distilled Emotions, essences, omens, uncut and lineage support gems, currency and the rest of poe.ninja\'s exchange categories), is priced from poe.ninja\'s exchange by its category',
    );
    expect(text).toContain('everything else (uniques, gear and tablets) from live trade listings.');
  });

  it("pricing.md's Which tool sends a unique and every exchange item to get_item_price, records the category, and reads Unavailable", () => {
    const text = pricing();
    expect(text).toContain(
      '- **A unique, and an item the currency exchange sells:** `mcp__pob2__get_item_price`, by name: a rune, soul core or idol in a socket, each Distilled Emotion of an anoint (by the name the record\'s anoint recipe gives), a lineage support gem. **Exchange items from poe.ninja; the trade site for the rest** (D-444)',
    );
    expect(text).toContain('`query` `{"exchange": "<category>", "name": "<item>"}` with the category the result names');
    expect(text).toContain("A result with an `Unavailable (<category>)` line records no price: the item is `unavailable`, note `not on poe.ninja's exchange (<category>)`.");
    // The emotion-only rule it replaces is gone.
    expect(text).not.toContain('**A unique, and each Distilled Emotion of an anoint:**');
    expect(text).not.toContain('`{"exchange": "Delirium", "name": "<emotion>"}`');
  });

  it("get_item_price's description states the route, and its first sentence (the README row) names both sides", () => {
    const tool = getTradeToolSchemas().find((t: { name: string }) => t.name === 'get_item_price');
    expect(tool).toBeDefined();
    const d = tool!.description as string;
    expect(d.startsWith("Quick price check for one item by name: an item the currency exchange sells is priced from poe.ninja's exchange, anything else on the PoE2 trade site.")).toBe(true);
    for (const part of ["'Perfect Body Rune'", "'Wolf Idol'", "'Liquid Envy'", 'runes, soul cores, idols', 'lineage support gems', "'Unavailable (<category>)'", 'with no trade request and no fallback to listings', 'Anything else (uniques, bases) is searched on the trade site']) {
      expect({ part, in: d.includes(part) }).toEqual({ part, in: true });
    }
    expect(d.length).toBeLessThanOrEqual(2048);
    const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
    expect(readme).toContain("| `get_item_price` | trade | Quick price check for one item by name: an item the currency exchange sells is priced from poe.ninja's exchange, anything else on the PoE2 trade site. |");
  });
});
