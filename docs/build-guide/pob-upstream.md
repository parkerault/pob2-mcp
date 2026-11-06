# PoB2 upstream

What PathOfBuilding-PoE2's GitHub tracker says about the PoB our pin runs, as of 2026-11-06: 135 open issues, 78 open
pull requests, and 98 pull requests merged to `dev` since our pin. The pin, v0.23.1 (2026-07-28), is still PoB2's
latest release, so nothing merged since then has shipped. `pob-gaps.md` is our own list of what the pin gets wrong; this
file says which of those entries upstream already knows about, and what else upstream has open.

**Who reads it.** Whoever files an upstream report (check §1 first), whoever adds an entry to `pob-gaps.md` (§2 lists
candidates), and whoever weighs a pin upgrade (§5). The build-guide pipeline doesn't read it.

**Numbers.** Every `#n` is PathOfBuilding-PoE2's (`https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/issues/<n>`;
GitHub redirects a pull request's number). "Issue" and "PR" say which. Unless a line says "checked on dev" (the file read
on the `dev` branch at the snapshot), it reports what the issue or PR says, not what we verified in code.

**How it was made.** Read-only `gh` queries: every issue (1,033) and PR (1,538), titles and bodies; the open issues
again with their comment threads. Each `pob-gaps.md` entry was searched by its distinctive terms, and the hits were read.
A report worded differently could be missed. Nothing was posted upstream. To refresh:

```bash
R=PathOfBuildingCommunity/PathOfBuilding-PoE2
gh release list -R $R --limit 3
gh issue list -R $R --state open --limit 500 --json number,title,body,labels,createdAt,comments
gh pr list -R $R --state all --limit 5000 --json number,title,body,state,createdAt,mergedAt
```

## 1. Our gaps upstream

Every `pob-gaps.md` entry not listed here (about 75 of them) has no issue or PR upstream. Our own entries (kind
"ours") and the closed PG-72 weren't searched.

| Gap | Upstream | State |
| --- | --- | --- |
| A skill granted by a support takes the support's level (PG-2) | PR #2521: the granted skill takes the active skill's level | Merged 2026-09-29, on dev. Issue #2584 (open, 2026-11-05) says Despair's triggered skills now count its +1 corruption, so the area is still moving. |
| Glory gates aren't modelled (PG-7) | PR #1436 shows Glory costs and a banner's Glory gain; it doesn't limit how often a skill is used | Open, related only |
| Lucky rolls averaged as uniform (PG-8) | Issue #2433: buffs mode applies lucky hits where the hideout figure doesn't (Lightning Rod, The Spring Hare) | Open, related only |
| Energy-based meta gems (PG-9) | Issues #181 (the general request), #505, #2166 (Cast on Critical rated at the socketed spell's cast speed) | Open since 2025-01. A contributor reported Cast on Critical working on a branch (#181, 2026-11-04). |
| Verglas's extra cold per crystal life (PG-22) | Issue #2389, PR #2390 | Open |
| Aftershock chance read nowhere (PG-24) | PRs #2579, #2535, #1438 | Open; no issue |
| Gemling quality effects (PG-31) | PR #2333 (in our pin) added them and says "still a bunch need supporting" | No issue for the rest |
| "Your Hits are Crushing Blows" (PG-32) | PR #2554, Heavy Stun uptime and Crushing Blows (closes feature request #834) | Open |
| Spirit of the Wolf on Rite of Passage (PG-34) | PR #2443 hooks the charm's variant lines | Open; probably covers it, unchecked |
| Way of the Stonefist (PG-36) | PR #2350 | Open |
| Cadiro's Gambit (PG-39) | Issue #2415, PR #2416 (#2422 closed) | Open. Issue #2156 (a unique added from PoB's list drops its first line when that line is unsupported and the item has no implicit) names Opportunity, also in PG-39. |
| Granted skills' supports: dropped on load (PG-54); an item's granted skill takes every support in its slot (PG-74) | PR #2498 makes item and tree granted skills supportable groups, with a weapon set each | Merged 2026-09-10, on dev. Checked on dev for PG-74: a granted group takes its own supports. PG-54's load path not traced. Regression issue #2529 open (§5). |
| "Runic Ward:" isn't read; every save adds a socket and a rune (PG-55) | PR #2146 | Merged 2026-08-31; checked on dev (`Classes/Item.lua` reads the line). PR #2367 (open) fixes a duplicated `Sockets:` line on rebuild. |
| A companion's rare monster modifiers (PG-56; PG-73's tablet modifier rests on it) | PR #2147 imports them from the character API's `tamedBeastProperties`; PR #2165 builds on it | Open |
| Herald of Blood's explosion (PG-65) | Issue #2573: the explosion ignores attack area modifiers | Open. It implies PoB computes the explosion, so PG-65's "possibly unmodelled" needs a re-check. |
| Supports counted across both weapon sets (PG-71) | Not filed. Checked on dev: the same "doesn't associate weapon skill supports" comment and loop. | Issues #2167, #510, #1079 ask for weapon-set handling generally. |
| Tempest Bell (part of PG-76) | Issue #2123 | Open |
| Copies and hits counted once (PG-77) | Issues #1850 (Ember Fusillade counts one projectile; PRs #1876, #2534 closed), #1035 (Rapid Assault's spears explode as one) | Open |
| Buffs with no stat map (PG-78) | Issues #2552 (Mana Tempest adds nothing), #714 (the Empowered option does nothing for Infernal Cry) | Open |
| Ailments added by another skill (PG-80) | Issue #2075 (Plague Bearer); PR #2541 adds a "sustained ignite" option for Flameblast with Oil Grenade, near but not the Oil Grenade line | Open |
| Pyromantic Pact (PG-84) | PR #2580; the older PR #742 | Open |
| A gain keyed to one type read after conversions (PG-87) | Issue #2004: gains and skill conversion in the wrong order; #1078 (closed 2025) | Open, related |
| Crafted jewel "increased Effect of Prefixes/Suffixes" (PG-99) | PR #2453, mod magnitude | Merged 2026-08-29; checked on dev (`Classes/Item.lua` reads the lines) |
| Timeless jewel seeds (PG-102) | Issue #1472. A maintainer: native support isn't coming soon; may bring back PoB1's manual node replacement. | Open |
| Prism of Belief's generated list (PG-105) | Issue #2549: Living Bomb missing from the list (the other direction) | Open, related |
| A support in a granted skill counts its group against the skill slots (PG-106) | PR #2411 | Merged 2026-08-26; checked on dev (`Classes/SkillsTab.lua` skips supports). Issues #2400, #2412 still open. |
| An imported character has every skill turned on (PG-107) | Issue #2401, an exact match | Open. Checked on dev: a re-import keeps your on/off choices; a first import still turns all on. |

## 2. Open issues that touch our numbers, not in `pob-gaps.md`

Candidates for `pob-gaps.md`, none checked against our pin's code. The first two matter most, because we load and import
builds all the time.

**Items and import**

- #2275: a build saved and reopened resets item mod rolls that have a decimal step to the middle of their range
  (+28 mana reads +30 after reopening); a character import gets the right values.
- #2582: an item on a base missing from `Data/Bases` (a Runemastered Long Quarterstaff) is dropped on import without a
  word; the main skill reads 0 DPS. PR #2583 open.
- #2156: adding a unique from PoB's list drops its first line when that line is unsupported and the item has no implicit
  (Opportunity, Lavianga's Spirits).
- #2344: Sylvan's Effigy loses "You can have any number of Companions of different types" on paste.
- #2406: Twisted Empyrean on a Runemastered base reads the plain base's damage; probably fixed on dev by #2511 and
  #2544 (Runeforged and Runemastered unique variants), unchecked.
- #2562: no Raven-Touched helmet anoints.
- #493: Queen of the Forest's movement speed penalty ignores other sources (PR #1921 closed).
- #2131: desecrated, mutated and fractured tags drop when a roll slider moves.
- #2568: an error choosing a 4th suffix on a Trarthan Cannon with Serle's Triumph's "+1 Suffix allowed".
- #2536: the import's main-skill guess picks the biggest group, a PoE1 rule; PR #1401 open.

**Offence**

- #2569: conditional or attack-only MORE accuracy, critical damage bonus and reload speed are ignored (Unerring Power
  with The Empty Roar). PR #2571 open.
- #2560: Drillneck's "for each time they have Pierced" lines parse partly and are dropped.
- #2532: a banner's aura effect multiplies with global aura effect instead of adding (Dread Banner ×2.88 against ×2.46
  in game).
- #2530: Supercharged Slam's fixed attack time follows the weapon's attack speed.
- #2567: Bitter Dead's explosion doesn't scale with spell modifiers.
- #2520: arrow speed changes nothing under Feathered Fletching.
- #2102: poison DPS on a cooldown skill misreads the "# of Poisons on enemy" setting.
- #2229: herald quality applies to both the buff and the explosion sub-skill; the buff sub-skill does nothing in PoE2.
- #2451: Predator's Mark doesn't count persistent minions, and stays on beside Mark for Death.
- #2273: The Taming's ailment bonus and Twister's ground buffs don't stack.
- #2575: an item's quality doesn't reach the skill it grants (a Shrine Sceptre's Purity). PR #2577 open.
- Unsupported skills and lines: #783 (Lightning Rod, extra arrows), #576 (Elemental Expression), #1542 (Tawhoa's
  Tending), #1049 (Beira's Anguish), #1848 (Unearth snapshotted on weapon set 2), #1183 (Rolling Slam's rotation), #820
  (Stampede's attack time), #413 (a secondary effect in Full DPS), #1417 (grenade cooldown in Mortar Cannon).
- Small: #2130 (reload time 0.70 against the trade site's 0.69), #2352 (Arc's infused stats need a config option, #2276).
- Probably stale or addressed: #178 (shock and chill on PoE1 values, 2025; #628 merged since), #562 (Monk base speed,
  2025), #760 (thorns; #1778 merged, in our pin), #2348 (rage on minions; #2425 merged on dev), #2151 (Mirage Archer's
  Spirit cost; #2234 merged, in our pin).

**Defence**

- #2570: defence conversions over 100% aren't scaled down, and a second target reduces the source twice. PR #2572 open.
- #2239: some defence lines lower EHP (mitigated hits drop), after #1929's fix.
- #2556: block in the EHP breakdown reads a "chance for block to fail" of 0.80 where 1 − 26% = 0.74 is expected.
- #328: leech follows PoE1 rules. PR #2550 open, and PR #1938 (enemy leech resistance, a leech cap).
- #953: Unnatural Resilience doesn't carry over through Forged in Flame.
- #1021: "buffs on you expire slower" adds to skill effect duration instead of multiplying (PR #1894 closed).
- #582: evasion in EHP on PoE1 lines (2025; may be stale since deflection).
- #1528: a Monk's evasion, Spirit and damage differ from the game (2025-11).
- #1756: For Utopia in EHP; a maintainer says #1940 (in our pin) fixed it.

**Skills, Spirit and slots**

- #2227: Cast on Minion Death takes minion reservation efficiency, which the game doesn't apply.
- #2154: the support gems' attribute check ignores weapon set 2's tree.
- #1009 (Unleash), #345 (concoctions): no supports in these granted groups; probably changed on dev by #2498, unchecked.
- #1786: no config option for a shapeshift form; the power report counts "while shapeshifted" nodes regardless.
- #1797: the sidebar's skill movement speed ignores action speed and slows.

**Tree and node power**

- PR #2559 (no issue): PoB's power pass caches each result by `modKey`, so nodes sharing one get the same score though
  a radius jewel, small-or-notable scaling or a weapon-set tag makes them differ. Our `pob-api/API/NodePower.lua`
  reproduces that cache on purpose (its comment names only the weapon-set twins), so `get_node_power` inherits it near a
  Time-Lost jewel.
- #2178: Cremating Cries counts as outside the nearby socket's small radius; the game counts it inside.
- #2380: Baryanic Leylines (Disciple of Varashta) unsupported; PR #1804 open, #2381 closed.
- #2056: the hidden notables (The Hollowkeeper, Path of the Renegade) don't show.
- #1971: the auto level reads 21 where the passive points need 23.

## 3. Open issues outside our scope

- **Crashes:** #566, #1619, #1741, #2120, #2122, #2388, #2526 (PR #2533 closed).
- **Login, install, platform:** #693, #1256, #1301, #1322, #1635, #1683, #1780, #2136, #2210, #2382.
- **UI and quality of life:** #414, #421, #812, #814, #1404, #1418, #1425, #1448, #1633, #1670 (PR #1770), #1671
  (PR #1931), #1690, #1726, #1731, #1785, #1805, #1849, #1857, #1962, #1988, #1989, #2189, #2200, #2201, #2204, #2205,
  #2449, #2558 (PR #2563), #2578.
- **Trade:** #615, #2430.
- **Content, exporter, other ports:** #284 (a Punch gem), #113 (PR #1909 closed), #1556, #1776, #1813, #2256.

## 4. Open PRs with no open issue that change numbers

- **A dev regression:** #2538 restores Fist of War, Ancestral Empowerment and Ancestral Call, which #2494 (merged on dev)
  stopped applying to damage. Our pin is unaffected.
- **Node power:** #2559 (above), #2557 (speed), #2555 (max hit by damage type as a power stat).
- **Parsing:** #2378 ("Enemies you Curse have −6% to Chaos Resistance" parsed but not applied), #1541 (charges and
  Volatility on kill; PG-45 is Volatility's rate cap), #572 (lucky damage in ailment hits), #788 (poison from non-hits).
- **Ascendancies:** #2581 and #1669 (Witchhunter's No Mercy), #2073 (Way of the Mountain), #1870 and #1665 (Pathfinder's
  traveller lines), #1804 (Baryanic Leylines), #1652 (Archon buff modifiers).
- **Mechanics:** #1820 (Impale), #1654 (Armour Break supports), #1648 (Hinder, Maim), #1427 and #618 (culling strike),
  #606 (Slow magnitude), #632 (recoup), #1938 and #2550 (leech), #1613 (rage sources), #1609 (Elemental Adaptation),
  #1606 (accuracy needed), #589 (supports in granted groups, 2025; #2498 since).
- **Items and data:** #1716 (0.4 uniques), #1202 (armour base rounding), #2564 and #2506 (trader).

## 5. On dev since our pin

What a pin upgrade would bring today; the procedure in `CLAUDE.md` ("Upgrading the PoB2 pin") still applies.

- **Game data:** #2505 exports 0.5.5 data and the trade data; our pin carries 0.5.4.
- **Our gaps:** PG-106 (#2411), PG-55 (#2146), PG-99 (#2453), PG-54 and PG-74 (#2498), PG-2 (#2521); see §1.
- **Known regressions:** issue #2529, `mainOutput is nil` on 100 of 1,438 public builds after #2498; and #2494's
  dropped ancestral boosts (fix #2538 open).
- **Calculation fixes:** #2542 (a radius jewel's functions piled up across mod-list rebuilds), #2466 and #2480 (block
  chance), #2485 (herald area), #2489 (Iron Grip), #2373 (Rakiata's Flow, "ignore non-negative resistances"), #2370
  (Ancestrally Boosted Strikes), #2477 and #2479 (conversion and area rounding), #2482 (Vulconus with Avatar of Fire),
  #2419 and #2516 (exposure), #2545 (Doedre's Undoing), #2465 (Drillneck on spells), #2461 (enemy resistance 0),
  #2457, #2458, #2460, #2478 (costs and precision), #2425 (minion rage).
- **Items and uniques:** #2511 and #2544 (Runeforged and Runemastered variants), #2455 (Grip of Kulemak), #2497 (Decree
  of Loyalty), #2547 (Geofri's Sanctuary, Sunken Vessel), #2524 and #2525 (rune mods), #2510 (Onslaught essence), #2366
  (Idolatry, Bonded lines), #1991 (Martial Artist rune slots), #2417 (maximum quality), #2472 (versioned unique variants).
- **Import and files:** #2507 (desecrated flag), #2486 (mod classes on import), #2491 (re-import showing old gem data),
  #2496 (Bringer of Rain's shield), #2475 (mirrored); #2512–#2515 make saved build XML deterministic, so a saved file's
  element and attribute order changes once.
- **Performance:** #2448, #2492, #2494.
