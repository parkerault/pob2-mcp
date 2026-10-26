# poe.ninja fixtures

## `currency-overview.response.json`

`GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=<league>&type=Currency`,
captured 2026-10-03 at about 14:00 local time during the recon trade audit (`User-Agent: pob2-mcp-server/0.1`). Pretty-printed,
otherwise as received. The league parameter was not recorded; it was probably `Runes of Aldur`.

Shape (official docs: https://poe.ninja/docs/api):

- `core.primary` = `"divine"`, `core.secondary` = `"chaos"`. The docs define `primary` per response
  as "the league's primary reference currency", so code must read it rather than assume divine.
- `core.rates` = `{"exalted": 440.6, "chaos": 2.7}`: units of each currency per 1 primary.
- `core.items[]`: `{id, name, image, category, detailsId}` for the core currencies.
- `lines[]` (47 entries): `{id, primaryValue, volumePrimaryValue, maxVolumeCurrency, maxVolumeRate,
  sparkline}`. `primaryValue` is the value in the primary currency, and `id` is the trade2 currency
  id (the join key for `listing.price.currency`).
- `items[]`: display metadata for `lines[].id`.

## `delirium-overview.response.json`

`GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=Delirium`,
captured 2026-10-17 (`User-Agent: pob2-mcp-server/0.2.2`), one request, for D-387. Pretty-printed, otherwise as
received. The Delirium category is the Distilled Emotions, named as PoB names them (`Liquid Envy`, `Ancient
Concentrated Liquid Isolation`): 26 `lines[]`, each `primaryValue` in the primary currency (`core.primary` =
`"divine"`), joined to `items[]` by `id` for the display name.

## `exchange/<category>.response.json`

`GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=<category>`, one
request per category, captured 2026-10-25 by WU-112's spike (`User-Agent: pob2-mcp-server/0.2.2`; serial requests,
no cookie), for D-444: every item the currency exchange sells is priced from its category. Thirteen categories:
`Currency`, `Fragments`, `Abyss`, `UncutGems`, `LineageSupportGems`, `Essences`, `SoulCores`, `Idols`, `Runes`,
`Ritual`, `Expedition`, `Breach`, `Verisium` (`Delirium`, the fourteenth, is `delirium-overview.response.json`
above). Trimmed, nothing else changed: the `image` of each item and the `sparkline` of each line are dropped, and
each `lines[]` and `items[]` entry is one line. The shape is the Currency overview's: `core` (`primary` `"divine"`,
`rates`), `lines[]` with `primaryValue` in the primary currency and the exchange's volumes, `items[]` naming each
`lines[].id`. `src/trade/exchange.ts` documents what each category lists; `tests/unit/exchangeKinds.test.ts` checks
that every listed item classifies to its category.
