# Spike S-3 — trade2 fixtures (2026-10-03)

**[V]** = verified against captured payloads or code read · **[I]** = inference.
Fixtures and per-file notes: [`tests/fixtures/trade2/`](../../../tests/fixtures/trade2/README.md).
League `Runes of Aldur`, realm `poe2`. Unauthenticated, no cookie, `User-Agent: pob2-mcp-server/0.1`.

## Verdict

**PASS** against the criterion (at least 4 fixtures, and the mod object shape confirmed). The
capture has 3 search→fetch pairs (30 items) plus 4 more searches, all anonymized. The mod shape is
confirmed but **corrected**: there are no `fracturedMods` or `desecratedMods` arrays.
**Blocking finding:** trade2 refuses weighted-sum queries without login, at any size. That
undercuts both the PoB2-driven upgrade search (D-5/D-6) and the optional session cookie (D-7). See §5.

**Requests used: 10/10** (7 search POSTs, 3 fetch GETs), spaced 10–30 s apart. No 429 and no
`Retry-After`.

## 1. Mod-line shape [V, 30 items]

Every mod line is an object. Real example (fetch-body-armour [0]):

```json
"explicitMods": [
  { "description": "30.5 Life Regeneration per second",
    "flags": { "fractured": true }, "domain": "fractured",
    "hash": "stat.fractured.stat_3325883026",
    "mods": [{ "name": "of Immortality", "tier": "S2", "level": 75,
               "magnitudes": [{ "min": "29.1", "max": "33" }] }] },
  { "description": "66% increased [EnergyShield|Energy Shield]",
    "flags": { "desecrated": true }, "domain": "desecrated",
    "hash": "stat.desecrated.stat_4015621042", "mods": [ … ] },
  { "description": "+191 to maximum Life", "domain": "explicit",
    "hash": "stat.explicit.stat_3299347043", "mods": [ … ] }
]
```

- `description`: display text containing `[Tag|Text]` markup.
- `domain`: one of `explicit | fractured | desecrated | crafted | implicit | enchant | rune`.
- `hash`: `stat.` followed by the trade stat id. Dropping the prefix gives the `/data/stats` id
  (e.g. `explicit.stat_3299347043`).
- `flags`: present only for `fractured`, `desecrated` and `crafted` lines.
- `mods`: missing on `runeMods`. Rare affixes carry `name`/`tier`/`level`. Unique, implicit and
  enchant lines carry only `magnitudes`, sometimes with `level`. Magnitudes are **strings**. One
  line can merge several mods: `+182 to [Evasion] Rating` comes from both `Rogue's` (P2) and
  `Banshee's` (P1).
- **Arrays seen:** `explicitMods`, `implicitMods`, `enchantMods`, `runeMods`. **Not seen in any
  of the 30 items:** `fracturedMods`, `desecratedMods`, `craftedMods`. Fractured, desecrated and
  crafted lines sit inside `explicitMods`, marked by `flags` and `domain`. (That they never
  appear is [I].)
- **`socketedItems[]`** (runes and gems) use a different shape. Their `explicitMods` objects have
  only `description`, `bondedMods` is a `string[]`, and a soul rune's `runeMods` is
  `["[SocketBound|Socket-bound]"]`, also strings. The parser therefore has to accept
  `string | object`. Each entry has `socket` (an index); gems have no `id`.
- `sockets: [{group, type: "rune"}]`. The flags `corrupted`, `doubleCorrupted`, `fractured`,
  `desecrated` and `mutated` are top-level booleans and are left out when false.
- `extended: {ar?, ev?, es?, ward?, hashes}`. **There is no `extended.mods`**, although
  `tradeTypes.ts` expects one. `hashes.<domain>` is `[[statId, [modIndex…]]]` and repeats the
  per-line `hash` (28/30 match exactly; on 2 Bijouborne it also holds `skill.cast_on_charm_use`
  from `grantedSkills`).
- `properties` / `requirements`: `{name, values: [[string, displayType]], displayMode, type}`, and
  names carry markup (`[EnergyShield|Energy Shield]`, `[Quality]` = `"+20%"`,
  `[Intelligence|Int]`).

## 2. Stripping `[Tag|Text]` markup

PoB2's `escapeGGGString` (`Modules/Common.lua:1078`) runs three gsubs: `<tag>{text}`→`text`,
`[Text]`→`Text`, `[Tag|Text]`→`Text`. The 201 captured lines use only the bracket forms
(`[Physical]`, `[Resistances|Lightning Resistance]`, `[ShamanOnlyMods|Bonded]: +40 to maximum
Life`), with no `<…>{…}`. The following TS equivalent gave output identical to PoB's on all 201
lines [V]:

```ts
s.replace(/<[^>]+>\{([^}]+)\}/g, '$1').replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
```

To feed fetched items to the engine, PoB2 turns each true flag into a `{fractured}`,
`{desecrated}` or `{crafted}` prefix (`TradeQueryRequests.lua:415-423`). Its item parser accepts
those (line-flag table, `Classes/Item.lua:101-113`) [V code].

## 3. Price / currency [V]

`listing.price = {type: "~b/o" | "~price", amount: number, currency: string}`. The capture has
currencies `exalted` (1–15), `divine` (1) and `chaos` (1). These ids match the trade
`price.option` values and the `/data/static` ids. All amounts were integers; fractional amounts
were not observed. `item.note` overrides the stash-tab price: ring [4] sits in tab
`"~price 20 exaltedRINGS"` with note `~price 1 divine`, and `listing.price` is 1 divine.

There are two listing shapes:
- **Instant buyout** (what status `available` returned): `fee` (gold), **no `whisper`**,
  `account: {name, online: null}`.
- **In person** (status `online`): `whisper` (localized to the seller's language: en_US, pt_BR,
  ru_RU), and `account.{lastCharacterName, language, realm, online: {league, status?}}`.

PoB2 reads `listing.whisper` unconditionally, so it gets nil on instant-buyout listings. Our
output must not assume a whisper exists.

## 4. Rate-limit headers (verbatim) [V]

Search:
```
x-rate-limit-policy: trade-search-request-limit
x-rate-limit-rules: Ip
x-rate-limit-ip: 5:10:60,15:60:300,30:300:1800,600:21600:3600
x-rate-limit-ip-state: 1:10:0,1:60:0,2:300:0,21:21600:0
```
Fetch:
```
x-rate-limit-policy: trade-fetch-request-limit
x-rate-limit-rules: Ip
x-rate-limit-ip: 12:4:10,16:12:300,50:300:300,1000:21600:1800
x-rate-limit-ip-state: 1:4:0,1:12:0,2:300:0,21:21600:0
```

- **How to read them.** Each limit triple is `maxHits:windowSeconds:penaltySeconds`; PoB parses it
  as `request:window:timeout` (`TradeQueryRateLimiter.lua:96-109`). A state triple is
  `hits:windowSeconds:activePenaltySecondsLeft`.
- **Search limits:** 5 per 10 s (60 s lockout), 15 per 60 s (5 min), 30 per 5 min (30 min),
  600 per 6 h (1 h).
- **Fetch limits:** 12 per 4 s (10 s), 16 per 12 s (5 min), 50 per 5 min (5 min), 1000 per 6 h
  (30 min).
- **Only an `Ip` rule appears without auth.** PoB's sample also shows an `Account` rule, which
  probably appears once authenticated [I].
- **No `Retry-After` was seen.** Without a 429, its format is unverified; PoB treats it as
  seconds.
- **State counts every client on the IP.** At my first request the 6 h window already showed 21
  searches. Rejected 400s still count: state rose 4→5→8 across the weighted attempts.
- **The current client parses these wrongly.** `tradeClient.ts:259-261` takes field [1] of the
  *first* triple as the limit (10, which is a window length) and ignores the other three windows.

Two other observed facts: a search returns at most **100 ids**, with `total` capped at **10000**
(two searches returned exactly 10000). Every response also sets an **anonymous `POESESSID`
cookie**, which the client must not store or send back.

## 5. Weighted-sum query — REJECTED without login [V]

I sent three weighted searches: PoB2's exact shape (weight group with 3 filters + `min`, empty
`and`/`not` groups, `mirrored: false`, `price.max`, sort `statgroup.0 desc`), a 2-filter group,
and a 1-filter group with only a category. All three returned:

```
HTTP 400 {"error":{"code":2,"message":"Query is too complex. Please reduce the amount of filters used.\nLogging in will increase this limit."}}
```

For comparison, an `and` group with 3 stat minimums + category + rarity + max price was
**accepted** (complexity 12). PoB2 budgets 54 complexity points for a weight group out of a
logged-in maximum of 200 (`TradeQueryGenerator.lua:999-1001`). So the anonymous limit is probably
below a weight group's base cost [I].

PoB2 only POSTs a search when it holds an OAuth bearer token (scope `account:trade`,
`PoEAPI.lua`). Without login it merely builds a URL,
`trade2/search/poe2/<league>/<base64url(gzip(query))>` (`TradeQuery.lua:1128-1131`). I confirmed
that the search `id` GGG returns is exactly base64url(gzip(query JSON)) by decoding all 4
accepted ids [V]. The TS side can therefore build such links offline; that the site accepts our
own encoding is [I]. PoB2 misreports this 400 as "Authorization is invalid. Please Re-Log"
(`TradeQueryRequests.lua:241-242`).

**Impact (needs a human decision before spec):**
- **What breaks.** The `find_upgrades` design runs PoB2's own query generator (D-5) and searches
  with a weighted stat group (D-6). The session cookie was meant to be optional (D-7). All three
  hold for plain search/fetch but **fail for weighted search when anonymous**.
- **Option (a):** weighted mode requires `POE_SESSION_ID`.
- **Option (b):** an anonymous fallback: an `and` group of required-stat minimums + max price,
  sorted by price, with fetched candidates ranked locally by engine delta. This is limited to
  100 ids per search and 10 per fetch. Ten fetches stay within the fetch limit of 50 per 5 min.
- **Option (c):** return a weighted `trade2` URL for the user to open while logged in.
- **Error text.** Errors should say "weighted search requires login", not "re-log".

## 6. Contradictions with recon §5

1. Recon expected `fracturedMods` / `desecratedMods` arrays. **They are absent**; those lines are
   in `explicitMods`, marked by `flags`/`domain`.
2. `runeMods` items are objects at the item level, but **strings inside `socketedItems`**.
3. There is no `extended.mods`; per-line `mods[]` replaces it.
4. Recon §1's "trade search works without POESESSID" holds only for **non-weighted** queries.
5. New facts: the 100-id/10000-total search caps, the two listing shapes (no whisper on instant
   buyout), and the anonymous `set-cookie`.
6. Not tested: fetches of more than 10 ids, 429 handling and `Retry-After` format, unpriced
   listings, fractional amounts, and `pseudoMods` "Sum:" lines (these need an accepted weighted
   query).
