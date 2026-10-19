# Brief: the Mobalytics review for the pattern library (2026-10-18)

**The user's direction.** "Use playwright to navigate the mobalytics builds home page and pick the ones you think
we currently have poor coverage on" (`https://mobalytics.gg/poe-2/builds`), using the Ascendancy filter and, where
the verified list is thin, the Creator and Community tabs. The coordinator picked the 16 below; the user approved
them ("The guides are fine"). The five optional guides were not taken. Picking other sources still needs the user.

**Why.** WU-90's standard kits are thin for want of common-practice sources (amendment 8, D-403, D-409): the
studies so far are mostly off-meta builds. These guides are popular builds in the archetypes the library covers
worst.

| # | Gap | Guide | URL | Tab | Fav. | Patch |
|---|---|---|---|---|---|---|
| 1 | Minions | Mattjestic, Fastest Minions Leveling & Mapping Pure Summoner | https://mobalytics.gg/poe-2/builds/god-slayer-minions-mattjestic | Creator | 1.6K | 0.5 |
| 2 | Minions | thyworm, Detailed SSF Minion Infernalist | https://mobalytics.gg/poe-2/builds/thyworm-infernalist-leveling | Creator | 1.2K | 0.5.5 |
| 3 | Tamed beast | CaptainLance9, Spirit Walker Beast Master | https://mobalytics.gg/poe-2/builds/spirit-walker-beast-master | Verified | 3.9K | 0.5 |
| 4 | Shapeshifting, talismans | Ronarray, Shaman Bear Druid | https://mobalytics.gg/poe-2/builds/bear-druid-build-league-starter-to-endgame | Verified | 8.4K | 0.5 |
| 5 | Shapeshifting | Woolie, Wolfman (Oracle) | https://mobalytics.gg/poe-2/builds/woolie-wolfman | Verified | 4.7K | 0.5.5 |
| 6 | Plants | Raxxanterax, Plant Oracle Druid Endgame | https://mobalytics.gg/poe-2/builds/plant-druid-oracle-endgame-guide | Verified | 3.2K | 0.5.5 |
| 7 | Lich; chaos damage over time | DEADRABB1T, ED Contagion Lich | https://mobalytics.gg/poe-2/builds/chaos-dot-lich-starter-deadrabbit | Verified | 6.7K | 0.5.5 |
| 8 | Poison | Path of Evening, Poison Pathfinder (leveling and endgame pages) | https://mobalytics.gg/poe-2/builds/poisonburst-arrow-pathfinder-leveling and https://mobalytics.gg/poe-2/builds/poison-burst-arrow-pathfinder | Creator | 821 | 0.5.5 |
| 9 | Shields, block | LexD, Shield Wall + Avatar of Fire Smith of Kitava | https://mobalytics.gg/poe-2/builds/avatar-of-fire-smith-of-kitava-lexd | Creator | 787 | 0.5.5 |
| 10 | Totems | Ky, 1-Button Arc Totems Gemling | https://mobalytics.gg/poe-2/builds/arc-gemling-path-of-ky | Verified | 1.7K | 0.5.5 |
| 11 | Ballistas | Lazy Exile, 1-Button Ballista Totem Cluster Grenade | https://mobalytics.gg/poe-2/builds/1-button-ballista-totem-cluster-grenade-lazy-exile | Verified | 454 | 0.5.5 |
| 12 | Crossbows, grenades | DEADRABB1T, Grenades Gemling League Starter | https://mobalytics.gg/poe-2/builds/deadrabbit-grenades-gemling-league-starter | Verified | 1.6K | 0.5.5 |
| 13 | Crossbows | Woolie, Run n Gun Witchhunter | https://mobalytics.gg/poe-2/builds/woolie-run-n-gun-witch-hunter | Verified | 4.7K | 0.5.5 |
| 14 | Spears; Amazon | Lazy Exile, Lightning Spear Amazon | https://mobalytics.gg/poe-2/builds/lazyexile-amazon-league-starter | Verified | 3.2K | 0.5 |
| 15 | Spears; Ritualist | MisoxShiru, Glacial Lance Ritualist | https://mobalytics.gg/poe-2/builds/misoxshiru-glacial-lance-ritualist | Verified | 792 | 0.5.5 |
| 16 | Invoker; cast on critical | Ronarray, Storm Wave + Flicker Invoker | https://mobalytics.gg/poe-2/builds/coc-balls-invoker-ronarray | Verified | 11.6K | 0.5 |
| 17 | Automated skill loop; Glory | Lyrthos, Autobomber Apocalypse Shaman | https://mobalytics.gg/poe-2/profile/iron-dragon-51lmv4/builds/8bbb709c-7667-4d03-84d2-43709633ab2a | Community | 20 | 0.5.5 |

Guide 17 is the user's own pick, added on 2026-10-18: an "autobomber" whose skills fire in an automated loop.

Not found: a spectre guide with real use (the only one had 2 favourites). Already studied: Fubgun's Lightning Arrow,
ronarray's Martial Artist, Navira's Fracturing.

**How it runs** (after M-20 merges, or alongside it):
1. The coordinator saves each guide page's text through Playwright, one page at a time, to a folder outside the
   repository (the pages are copyrighted; nothing of them is committed).
2. Study agents (no tests, no network) read the saved text and write one study each under
   `docs/build-guide/studies/`, in the existing studies' format, paraphrased: the archetype's kit, levers, leveling,
   gear, defences, and what the guide says players pick.
3. The coordinator proposes library changes (the kits first) from the studies; the user approves them (C-53).

**Cost:** about 150–200K tokens per guide, 2.5–3.5M in all.

## The saved pages (2026-10-18)

All 17 pages were saved on 2026-10-18 to `/home/parker/projects/pob2-mcp-wt/mobalytics-cache/`, outside the
repository, about 148,000 words in all. Each file holds a header (URL, title, the variant tab names), the whole
page's text on the first variant tab, and then, for each tab, the sections that change with it (Build Variants
through Passive Tree). Widgets come through as bare labels: item base names (affixes show only on hover, so they
are missing), gem names with their level and supports, numbered priority lists, and the tree's point counters
(the tree itself is not text). Guide 14's file repeats the whole page under each tab. Guide 8 has two files,
the leveling page (`08a`) and the endgame page (`08b`).

## The study brief

One agent per guide. Each writes one study, `docs/build-guide/studies/2026-10-18-mob-<slug>.md`, cited in the
library as `[mob-<key>]`:

| # | File | Saved text | Key |
|---|---|---|---|
| 1 | `2026-10-18-mob-mattjestic-minion-infernalist.md` | `01-mattjestic-minions.txt` | `mob-mattjestic` |
| 2 | `2026-10-18-mob-thyworm-minion-infernalist.md` | `02-thyworm-infernalist.txt` | `mob-thyworm` |
| 3 | `2026-10-18-mob-captainlance9-beast-master.md` | `03-captainlance-beastmaster.txt` | `mob-beastmaster` |
| 4 | `2026-10-18-mob-ronarray-shaman-bear.md` | `04-ronarray-bear-druid.txt` | `mob-bear` |
| 5 | `2026-10-18-mob-woolie-wolfman-oracle.md` | `05-woolie-wolfman.txt` | `mob-wolfman` |
| 6 | `2026-10-18-mob-raxx-plant-oracle.md` | `06-raxx-plant-oracle.txt` | `mob-plants` |
| 7 | `2026-10-18-mob-deadrabbit-ed-contagion-lich.md` | `07-deadrabbit-ed-lich.txt` | `mob-ed-lich` |
| 8 | `2026-10-18-mob-path-of-evening-poison-pathfinder.md` | `08a-evening-poison-leveling.txt`, `08b-evening-poison-endgame.txt` | `mob-poison` |
| 9 | `2026-10-18-mob-lexd-shield-wall-smith.md` | `09-lexd-shield-smith.txt` | `mob-shield-wall` |
| 10 | `2026-10-18-mob-ky-arc-totems-gemling.md` | `10-ky-arc-totems.txt` | `mob-arc-totems` |
| 11 | `2026-10-18-mob-lazy-exile-ballista-grenade.md` | `11-lazyexile-ballista.txt` | `mob-ballista` |
| 12 | `2026-10-18-mob-deadrabbit-grenades-gemling.md` | `12-deadrabbit-grenades.txt` | `mob-grenades` |
| 13 | `2026-10-18-mob-woolie-run-n-gun-witchhunter.md` | `13-woolie-witchhunter.txt` | `mob-witchhunter` |
| 14 | `2026-10-18-mob-lazy-exile-lightning-spear-amazon.md` | `14-lazyexile-spear-amazon.txt` | `mob-spear-amazon` |
| 15 | `2026-10-18-mob-misoxshiru-glacial-lance-ritualist.md` | `15-misoxshiru-glacial-lance.txt` | `mob-glacial-lance` |
| 16 | `2026-10-18-mob-ronarray-storm-wave-invoker.md` | `16-ronarray-invoker.txt` | `mob-invoker` |
| 17 | `2026-10-18-mob-lyrthos-autobomber-shaman.md` | `17-iron-dragon-autobomber.txt` | `mob-autobomber` |

**Read first:** the saved text, all of it; in `.claude/skills/build-guide/references/patterns.md`, "How to read
an entry", "Standard kits" and the entries the guide touches; `2026-10-09-guide-comparison-2-ronarray-page.md`
for the format.

**The study's sections:**
1. **Header.** The guide, author, URL, tab (Verified, Creator or Community), favourites, patch, last update,
   the variant tabs in order, and what the capture couldn't hold.
2. **What the build is.** The damage source, the ascendancy, how it kills packs and bosses, how it plays.
3. **The kit.** Weapon and off hand; the main skill's supports; the other skills (movement, buffs, auras,
   curses) and what they reserve; the uniques it needs and when; the ascendancy order; the tree's direction.
4. **The levers.** What scales its damage, in the guide's priority order, and what it says it can skip.
5. **Leveling.** The campaign skills and gear, the swap points, and what changes between tabs.
6. **Gear and budget.** The progression across the tabs, the stat priorities, the expensive pieces.
7. **Defences.** The layers and any numbers the guide gives.
8. **What players pick.** Every place the guide says what is standard, common, or what most players do.
9. **For the library.** Up to 8 kit lines for the archetype's Standard kits section, written in its style, each
   citing this study's section (`[mob-<key>] §n`); candidate pattern shapes the build shows, each matched to an
   existing entry or marked new; and what PoB might not model. Mark each claim checked or unverified.

**Rules:**
- **Paraphrase.** The repository is public: never copy a passage; a short phrase (under 15 words) in quotes, at
  most a few times. Names of skills, items and passives are fine.
- **No network.** No browser, WebFetch or WebSearch; don't open the guide's page again.
- **Lookups.** Up to 10 calls to `mcp__pob2__lookup_game_data`, `mcp__pob2__search_tree_nodes`,
  `mcp__pob2__list_gems` or `mcp__pob2__check_model_coverage`, to check a load-bearing name or what PoB models
  at the pin. No other pob2 tool.
- **Write only the study file.** No other edits, no commits, no tests, no builds.
- Ignore the comments; never name a commenter.
- 1,200–2,500 words.
- **Report back:** the file path, its word count, and the 3–5 kit lines you'd propose first, in under 150 words.
