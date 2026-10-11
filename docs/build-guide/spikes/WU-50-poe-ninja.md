# WU-50: poe.ninja spike (S-N1)

Date 2026-10-10 (requests logged in UTC, 2026-10-11 01:02–01:04). Branch `bg/wu-50`. **[V]** = read or
measured here, **[I]** = inference.

**Outcome: blocked.** poe.ninja's API Reference says the builds and profiles API, and every other
non-economy endpoint, is "not available for third-party use" **[V]** (§3.1). Skill and ascendancy popularity,
the build index and peers all come from that API. The stop rule for this spike ("the terms forbid this use")
fires, so no builds, character or Path of Building endpoint was called or looked for. C-54's tools and the
popularity threshold are not settled. They need a decision by the user (§5).

## 1. Decision lines (AC-K52)

| Element | Decision | Where |
|---|---|---|
| Endpoints | Sanctioned: only the four documented economy endpoints. The builds/profiles API is internal and off limits. Not discovered, by the terms | §3.2 |
| Response shape | Economy endpoints: as documented (DTO tables quoted). Builds API: not fetched (terms) | §3.3 |
| Rate limits | None published. No rate-limit header seen. Usage guidelines: HTTP cache about 5 min (ETag), PoE2 data refreshes about hourly, "reasonable" concurrency, misbehaving clients blocked | §3.4 |
| Terms | Builds/profiles, character, Path of Building and authentication endpoints: "not available for third-party use". The economy endpoints are the "supported public surface" | §3.1 |
| C-54 tool count, names, arguments, outputs, engine kinds | **Not settled: blocked.** No sanctioned endpoint serves popularity, the build index or peers. User decision among §5's options | §4, §5 |
| C-54 cache lifetime and back-off | **Not settled: blocked.** Values for an economy-only tool, if the user picks option C, are in §5 | §5 |
| Popularity threshold for the deck's under-played rule (D-298) | **Not settled: blocked.** There is no sanctioned popularity data to set it from | §4, §5 |

## 2. The question

Amendment 3 turns poe.ninja on by default (D-297): server tools in group `ninja` give the brainstorm
researchers and the coordinator three kinds of player evidence:
- the share of characters by skill and by ascendancy (popularity);
- the characters using a combination, and their levels (the build index);
- what similar characters run (peers).

Each dealt deck must hold at least two cards below a popularity threshold (D-298), and this spike sets that
threshold (D-324). The API's shape, limits and terms were marked ungrounded (R-35). WU-50 grounds them and
proposes C-54, the poe.ninja tool contract: its tools, arguments, outputs, engine kinds, cache lifetime and
back-off.

## 3. Findings

### 3.1 Terms [V]

Source: `https://poe.ninja/docs/api` ("API Reference"), linked as "API Reference" from `https://poe.ninja/docs`,
which the home page's footer links as "Docs & FAQ". Quoted from the cached page:

> **What is supported.** The economy overview endpoints documented on this page are the supported public
> surface of the poe.ninja API. They cover economy pricing for Path of Exile 1 and Path of Exile 2.

> **What is not allowed.** The builds / profiles API, and every other non-economy endpoint (character, Path
> of Building, authentication), are internal. They are undocumented, unsupported, and not available for
> third-party use, and they may change or break at any time.
>
> If you've reached out about building on the builds / profiles API: it's nothing personal, and it's not
> that your idea isn't a good one. We get a lot of these requests, and that number has risen sharply as
> AI-assisted development has taken off. Apps that behave badly against the builds / profiles API regularly
> cause serious load problems. The builds / profiles API is closed for two concrete reasons:
> - It is significantly more performance-intensive to serve than economy data, and when it gets overloaded
>   it causes real, time-consuming problems for keeping the site running.
> - Many players deliberately hide their characters or make their profiles private, and they change these
>   settings frequently, for example to hide a specific character. Serving that data to third parties
>   directly would bypass that privacy choice.
>
> Clients that misbehave against these endpoints, or make excessive use of the economy endpoints, will be
> blocked.
>
> **Looking for an official data feed?** Grinding Gear Games offers an official API you can apply for. See
> the GGG developer docs.

> **No stability guarantee.** This API exists to run the poe.ninja website, not as a product. Public access
> to the economy endpoints is allowed but incidental. […] There is no versioning and no SLA, and breaking
> changes can happen to the economy endpoints without notice.

> **If you are building an app.** Desktop apps and other clients should proxy these requests through their
> own backend rather than calling the endpoints directly from end-user machines. That lets you cache
> responses, set a proper User-Agent, and control request volume instead of pushing per-user traffic
> straight at us.

The privacy policy (`/privacy`, the footer's only other policy page) is a generic CCPA notice. It says
nothing about API use. There is no separate terms-of-service page in the footer **[V]**.

**This clause is not new.** The stabilization grounding quoted the same "What is not allowed" sentence on
2026-10-03 (`docs/stabilization/grounding/ctx-external.md:182-183`). Amendment 3 and R-35 did not cite it.

### 3.2 Endpoints [V]

The documented, sanctioned PoE2 endpoints are all economy endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /poe2/api/economy/leagues` | Active economy leagues; "the first entry is the current temporary challenge league" |
| `GET /poe2/api/economy/exchange/current/overview?league={league}&type={type}` | Currency-exchange prices. PoE2 `type`: `Currency`, `Fragments`, `Abyss`, `UncutGems`, `LineageSupportGems`, `Essences`, `SoulCores`, `Idols`, `Runes`, `Ritual`, `Expedition`, `Delirium`, `Breach`, `Verisium`. C-12's currency rates already use it (`src/services/poeNinjaClient.ts`) |
| `GET /poe2/api/economy/stash/current/item/overview?league={league}&type={type}` | Unique item prices. PoE2 `type`: `UniqueWeapons`, `UniqueArmours`, `UniqueAccessories`, `UniqueFlasks`, `UniqueCharms`, `UniqueJewels`, `UniqueSanctumRelics`, `UniqueTablets`, `PrecursorTablets` |
| (PoE1 only) `GET /poe1/api/economy/stash/current/currency/overview` | Not PoE2 |

None of them carries a skill, an ascendancy, a character or a build. Popularity, the build index and peers
live only in the builds/profiles and character API, which the terms close. I did not look for its endpoints:
no JS bundle (`assets.poe.ninja/_astro/*.mjs`) and no `/poe2/builds` page was fetched, because discovering an
API the terms forbid would be the work-around the stop rule rules out.

"Data dumps" (`/poe1/data`) is PoE1 economy data: the page's analytics content group is
`"poe1/Economy Data Dumps"`, and the page links no PoE2 or builds dump **[V]**. It is not a sanctioned source of
build data.

### 3.3 Response shapes

- **Economy endpoints** [V, docs]. The page documents the DTOs:
  - `EconomyLeagueDto {id, name}`. `id` is "League identifier. Pass this as the league query parameter on the
    other endpoints."
  - Exchange overview: `lines[]` (`CurrencyExchangeOverviewLineDto`: `id`, `primaryValue`,
    `volumePrimaryValue`, `maxVolumeCurrency`, `maxVolumeRate`, `sparkline`) and `core`
    (`CurrencyExchangeEconomyCoreDto`: `primary`, `secondary`, `rates`, `items`). A real response is
    committed at `tests/fixtures/poeninja/currency-overview.response.json`.
  - PoE2 stash item overview: `lines[]` (`Poe2ItemOverviewLineDto`): `id`, `itemId`, `detailsId`, `name`,
    `baseType`, `variant`, `category`, `primaryValue`, `listingCount` ("Number of current listings backing
    the price"), `corrupted`, `levelRequired`, `limitedTo`, `radius`, `implicitModifiers`,
    `explicitModifiers`, `grantedSkillModifiers`, `propertyModifiers`, `requirementModifiers`,
    `utilityModifiers`, `flavourText`, `icon`, `sparkLine`.
- **Builds/profiles API**: not fetched (§3.1). No shape is recorded, and none should be inferred from the
  site's network traffic.
- **The site itself** [V]. It is an Astro app rendered in JavaScript. The pages' HTML carries only the
  footer text plus a `TopBar` island whose props hold the PoE1 index state (economy leagues, snapshot
  versions). The home page's props hold no PoE2 index state. A trimmed raw excerpt of the home page:

  ```
  <astro-island uid="KbIHf" component-url="https://assets.poe.ninja/_astro/a.5l-tf9Lf.mjs"
   component-export="TopBar" … props="{&quot;switchGameLink&quot;:[0,&quot;/&quot;],
   &quot;gameContext&quot;:[0,&quot;poe1&quot;],&quot;mode&quot;:[0,&quot;global&quot;],
   &quot;poe1IndexState&quot;:[0,{&quot;economyLeagues&quot;:[1,[[0,{&quot;name&quot;:[0,&quot;Allfla…
  ```

### 3.4 Rate limits [V]

- **Published:** no number. The usage guidelines on `/docs/api`:
  - "Responses are HTTP-cached (roughly 5 minutes, ETag-based). Use conditional requests and respect the
    cache headers; do not bypass caching."
  - "The underlying data refreshes infrequently (PoE 1 overviews roughly every 15 minutes, PoE 2 roughly
    hourly), so polling faster than a few minutes wastes bandwidth for no fresher data."
  - "Send a descriptive User-Agent that identifies your app and a contact."
  - "Be reasonable with concurrency and volume; this is a community resource."
  - "Don't use the API to directly replicate the site. Use it to build something new and exciting."
- **Observed:** 5 page requests, all HTTP 200, behind Cloudflare. Each response carried
  `cache-control: public, max-age=600`, and none carried `x-ratelimit-*`, `ratelimit-*` or `retry-after`.
  Trimmed headers of `/docs/api`:

  ```
  HTTP/2 200
  content-type: text/html
  cache-control: public, max-age=600
  last-modified: Sun, 11 Oct 2026 01:03:16 GMT
  cf-cache-status: EXPIRED
  server: cloudflare
  ```
- **Enforcement:** blocking ("Clients that misbehave … will be blocked"). A block would most likely hit the
  user's IP **[I]**, and so also C-12's currency rates, which the price tools use to normalize prices.

### 3.5 Tensions with what is built today (not new; for the record)

The sanctioned economy use (`get_currency_rates`) has two known tensions with the guidelines, both recorded
in the stabilization grounding (`ctx-external.md:297-300, :316-319`):
- the User-Agent `pob2-mcp-server/0.2.2` (`src/utils/userAgent.ts`, D-25) names no contact, by design, so no
  request identifies the user;
- the server calls from the user's machine rather than a proxy.

At about one request per league per hour it is a single-user tool's volume. Neither tension is changed here.

## 4. What the block affects

These rest on a source the terms close. None can be built as written:
- **C-54**, the poe.ninja tools (spine C-54, slice 01 §2.10). All three uses are popularity, the build index
  and peers.
- **D-297**, poe.ninja on by default, as far as it adds those tools. Its development allowance and C-12's
  currency rates are unaffected: both use the sanctioned economy surface.
- **D-298**, at least two cards per deck below a popularity threshold, and **D-324**, the threshold set from
  the data.
- **D-316's restatement** of the tool counts by WU-52. With no new tools, the counts stay 84, and 83 with
  `POE_NINJA_DISABLED=true`.
- **WU-52** (the tools), **AC-K47…AC-K49** (their group, offline tests and politeness), and **WU-57's** use of
  the tool names. Also the card's "players use it (poe.ninja)" status word and its Evidence block (C-52):
  popularity of the skill and the ascendancy, characters using the combination and their levels.
- **The brief's empty-ascendancy and empty-brief seeding** "from under-played ones when poe.ninja is on"
  (amendment 3 Q2 and the R1a foci table).

Unaffected: `get_currency_rates` and price normalization (C-12), `--no-ninja` and `POE_NINJA_DISABLED`, and
the "no player evidence" wording (D-333), which becomes the only path.

## 5. Options for the user (not decided)

Each option changes a settled decision or a tool contract, so it is the user's call (HG-12 for tool-set
changes; D-297 and D-298 are the user's rulings).

- **A. Withdraw the player-evidence tools.** C-54 adds no tools. D-298 is withdrawn, and every card's Evidence
  says "no player evidence". Spec edits: C-54, D-297, D-298, D-316, D-324, AC-K47…AC-K49, WU-52 (dropped or
  emptied), WU-57's tool names, and C-52's status word. This is the smallest change and is fully within
  poe.ninja's terms.
- **B. User-supplied player evidence.** The user, browsing poe.ninja as an ordinary visitor, adds popularity
  notes to the brief (for example in its `notes` field). Cards cite them as user-supplied, and no tool
  fetches anything. This fits the project's rule that the user picks external sources. D-298 could then
  become advisory ("favour skills the user calls under-played") instead of a numeric threshold. It combines
  with A.
- **C. An economy-only signal.** One sanctioned tool over the PoE2 stash item overview, giving a unique's
  price and `listingCount` (current listings). It measures market supply of an item, not how many characters
  play a skill or an ascendancy, so it cannot ground D-298's threshold or the build index. If chosen, it
  would use:
  - a 60-minute cache per league and type (PoE2 data refreshes about hourly; the currency cache already uses
    60 minutes, `currency.ts:97-98`);
  - `If-None-Match` conditional requests;
  - serial requests;
  - on HTTP 429 or 5xx, a 60-second back-off, then one retry, then a stated failure.

  Unique prices overlap C-12's trade pricing, so its value to the brainstorm is low **[I]**.
- **D. GGG's official API.** poe.ninja points to `https://www.pathofexile.com/developer/docs` (recorded, not
  opened). It needs an application to GGG, and every pathofexile.com request is gated for agents (HG-1).
  Whether it serves PoE2 ladder or character data is unverified. It would be a new contract (HG-12) and a
  new spike.
- **Not an option:** calling the builds API anyway, under any User-Agent, or scraping `/poe2/builds` pages.
  The terms forbid it. poe.ninja names AI-assisted apps as a cause of load problems. A block would also cut
  off C-12's currency rates.

**Recommendation:** A now, with B as a cheap addition if the user wants player evidence on cards. C adds a
tool for a signal the deck can't use. D is a separate, larger decision.

## 6. AC-K52 script check

AC-K52: "The report … covers each item under WU-50's `produces`: the endpoints, response shape, rate limits
and terms of poe.ninja's PoE2 popularity and build-index API; C-54's tool names, arguments, outputs, engine
kinds, cache lifetime and back-off; and the popularity threshold for D-298, with a decision line for each."

| Required element | Where | Result |
|---|---|---|
| Endpoints | §3.2 | Covered. The sanctioned endpoints are listed. The popularity and build-index endpoints are deliberately not discovered (terms) |
| Response shape | §3.3 | Partly covered: the economy DTOs and the site's HTML. Builds API: not fetched (terms) |
| Rate limits | §3.4 | Covered: none published; guidelines and observed headers |
| Terms | §3.1 | Covered, verbatim |
| C-54 tool names, arguments, outputs, engine kinds | §1, §5 | Decision line present: **not settled, blocked** |
| C-54 cache lifetime, back-off | §1, §5 | Decision line present: **not settled, blocked**. Option C's values are given conditionally |
| D-298 popularity threshold | §1, §4 | Decision line present: **not settled, blocked** |
| A decision line for each | §1 | Present, 7 lines |

**Verdict: AC-K52 is not met.** Three of its elements can't be settled without breaking poe.ninja's terms.
The unit stops at the spike's stop condition ("the terms forbid this use"), and the decision goes to the
user.

## Appendix A: request log

Every request: `curl --compressed --max-time 30 -A "pob2-mcp-server/0.2.2"`, with no cookie, `Referer` or other
identifying header. One request at a time, at least 3.5 s apart (the helper enforced the gap). No URL was
fetched twice, no request returned 429 or 5xx, and no retry was needed. Bytes are the decoded body size on
disk. Time is curl's total time.

| # | UTC start | URL | Status | Bytes | Time (s) |
|---|---|---|---|---|---|
| 1 | 2026-10-11T01:02:53Z | `https://poe.ninja/` | 200 | 181996 | 0.143 |
| 2 | 2026-10-11T01:03:11Z | `https://poe.ninja/docs` | 200 | 187682 | 1.046 |
| 3 | 2026-10-11T01:03:17Z | `https://poe.ninja/docs/api` | 200 | 238613 | 1.176 |
| 4 | 2026-10-11T01:03:46Z | `https://poe.ninja/poe1/data` | 200 | 180951 | 1.089 |
| 5 | 2026-10-11T01:04:14Z | `https://poe.ninja/privacy` | 200 | 192359 | 1.063 |

Total: 5 requests, 981,601 bytes. How each URL was reached: #1 is the site root; #2, #4 and #5 are footer links
on #1; #3 is linked from #2.

## Appendix B: links to other hosts (recorded, not opened)

- `https://www.pathofexile.com/developer/docs`: GGG's developer docs, linked from `/docs/api` ("Looking for an
  official data feed?"). pathofexile.com is forbidden to agents.
- `https://discord.gg/7qSRyKdyre`: poe.ninja's Discord, in every footer.
- `https://assets.poe.ninja/_astro/*.mjs`: the site's JS bundles. These are a poe.ninja subdomain, but they
  were not fetched because the terms made API discovery moot (§3.2).
- Third-party analytics and ad scripts in the pages' HTML (googletagmanager.com, ezojs.com,
  ezoicanalytics.com, gatekeeperconsent.com) and two youtube.com videos linked from the home page's news
  posts.

## Appendix C: the cache

`/home/parker/projects/pob2-mcp-wt/ninja-cache/`, outside the repository. Each URL `u` is stored as
`quote(u, safe="")` + `.body` (the decoded body) and `.headers` (the response headers), so
`urllib.parse.unquote(<name>)` gives the URL back. `requests.tsv` is the log above, with the cache name per
row. No API response is in it, only the five HTML pages. A fixture for an economy endpoint, if option C is
chosen, would need its own polite request. The currency overview fixture already exists
(`tests/fixtures/poeninja/`).
