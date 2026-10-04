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
