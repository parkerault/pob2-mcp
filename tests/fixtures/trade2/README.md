# trade2 fixtures (spike S-3)

Raw responses from the PoE2 trade API (`https://www.pathofexile.com/api/trade2`), captured for
offline tests of the trade client. Report and analysis:
[`docs/stabilization/spikes/S-3-trade2-fixtures.md`](../../../docs/stabilization/spikes/S-3-trade2-fixtures.md).

- **Captured:** 2026-10-03, 19:58–20:04 UTC.
- **League / realm:** `Runes of Aldur` / `poe2` (league list taken from the earlier audit's
  `/data/leagues` capture; not re-requested).
- **Client:** unauthenticated, no cookie sent, `User-Agent: pob2-mcp-server/0.1`. Search =
  `POST /api/trade2/search/poe2/Runes%20of%20Aldur` with the `*.request.json` body; fetch =
  `GET /api/trade2/fetch/<10 ids>?query=<search id>` (same form PoB2 uses).
- All JSON is pretty-printed exactly as received apart from the anonymization below.

## Files

Each capture has up to three files: `<name>.request.json` (POST body sent), `<name>.response.json`
(body received), `<name>.headers.json` (`{status, request: {method, url}, headers}` — header
names lower-cased, values verbatim).

| Files | Request | Result | Covers |
|---|---|---|---|
| `search-body-armour.*` | `armour.chest`, rarity `rare`, `fractured_item` + `corrupted` = `"true"`, status `available`, sort `price asc` | 200, total 6045, 100 ids, complexity 11 | search response shape; **search** rate-limit headers |
| `fetch-body-armour.*` | first 10 ids of the above | 200, 10 items | rare explicit mods with tiers; **fractured** (13 lines) and **desecrated** (10 lines) mods inline in `explicitMods` with `flags`; `runeMods` + `socketedItems` (Greater Iron Rune ×2 on 4 items; soul rune *Medved's Tending* on [9]); `implicitMods` ([1], [6]); `enchantMods` + `doubleCorrupted` ([3]); crafted line `flags.crafted` ([5]); `corrupted` on all; `extended.ar/ev/es/ward`; instant-buyout listing shape (`fee`, no `whisper`, `account.online: null`); prices `~b/o` 1–15 **exalted**; **fetch** rate-limit headers |
| `search-ring-divine.*` | `accessory.ring`, `rare`, price `{option: "divine", min: 1}`, status `online` | 200, total 1112, complexity 9 | currency-restricted price filter |
| `fetch-ring-divine.*` | first 10 ids | 200, 10 items | `implicitMods` on every item (with `mods[].level`); corrupted ring [0]; in-person listing shape (`whisper`, `account.lastCharacterName/language/realm`, `online: {league, status?}`); localized whispers (en_US, pt_BR, ru_RU); prices `~price`/`~b/o` 1 **divine**; tab-name price overridden by item note ([4]) |
| `search-belt-unique-chaos.*` | `accessory.belt`, `unique`, price `{option: "chaos", min: 1}`, status `available` | 200, total 10000 (cap), complexity 9 | — |
| `fetch-belt-unique-chaos.*` | first 10 ids | 200, 10 items | **uniques** (Soul Tether, Coward's Legacy, Darkness Enthroned, Umbilicus Immortalis, Bijouborne): unique mod lines carry `mods[].magnitudes` only; `mutated: true` (Cultivated Vaal unique, property `Vaal Belt`) on 6; corrupted + `enchantMods` ([1], [4]); empty rune sockets ([4]); `grantedSkills` + socketed gem without `id` ([8], [9]); `flavourText`; prices `~b/o` 1 **chaos** |
| `search-weighted-pob-shape.*` | weighted-sum group exactly as PoB2's `TradeQueryGenerator` emits it (weight group with 3 filters + `min`, empty `and`/`not` groups, `misc_filters.mirrored: false`, `price.max` 30 exalted-equivalent), sort `statgroup.0 desc` | **400** `Query is too complex … Logging in will increase this limit.` | rejection of weighted queries without auth |
| `search-weighted-2-filters.*` | minimal weight group (2 filters, `min` 100) + category + price max | **400**, same error | — |
| `search-weighted-1-filter.*` | weight group with a single filter + category only | **400**, same error | weight groups are refused anonymously at any size |
| `search-and-3-stats.*` | `armour.chest`, `nonunique`, price max 30, `and` group with 3 stat mins (life ≥ 80, fire res ≥ 20, cold res ≥ 20) | 200, total 10000, complexity 12 | anonymous fallback query (no fetch — request budget used up) |

Indices `[n]` above are positions in the fetch `result` array.

## Anonymization applied

Item data is untouched. Changes, all structure- and type-preserving:

- `listing.account.name` → `seller-N#000N` (stable per real account across all files).
- `listing.account.lastCharacterName` → `character-N`; the `@<name>` at the start of
  `listing.whisper` replaced with the same placeholder.
- `listing.stash.name` → `tab-N` unless it is purely numeric or a price note (`~b/o …` / `~price …`,
  which drives pricing and is kept); the quoted tab name inside `whisper` is replaced to match.
- Item ids (`result[].id`, `item.id`, `socketedItems[].id`, the search `result` list and the ids in
  the fetch URLs) → `sha256("pob2-mcp-fixture:" + realId)` hex. Same 64-hex format, consistent
  between each search response and its fetch, but they no longer resolve to live listings.
- The anonymous `POESESSID` the server sets in `set-cookie` → `<redacted-anonymous-session>`. We
  never send it back.
- Kept: `account.online`, `language`, `realm`, `listing.indexed`, `stash.x/y`, `fee`, `item.note`,
  item names, the search `id` (it is just base64url(gzip(query JSON)) and holds no identity).
