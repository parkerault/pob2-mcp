# Guide comparison 2: ronarray's Martial Artist Monk guide (Mobalytics page)

An agent's study report, kept verbatim (2026-10-09). Brief: given in the prompt.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## ronarray's Martial Artist Monk guide on Mobalytics, compared with amendment 2

I read the whole page. All 8 variant tabs loaded and are synced across the page's sections. I opened "Show All" on the equipment and gem priority lists, all 4 quest-reward filters, and weapon Set 1 and Set 2. I didn't open any other page, the browser is closed, and the repo is clean.

**What I couldn't fully read:**
- **Item details.** Each item's affixes only show on hover. I got them for two items (the weapon and the body armour); for the rest the hover didn't trigger.
- **Gem order list.** It shows support gems as unlabelled icons, so I couldn't name those steps.
- **Passive tree.** I read only its text: the points counter and the notes.

Page facts: updated Sep 7 2026, patch 0.5.5, 11.3K favourites, 85 comments.

### 1. Shape

The layout is a fixed Mobalytics template. Eight tabs, each a full loadout, are listed by the guide in this order: **Lvl 1-23 → 23+ Unarmed → Act 3-6 → Campaign End / Early Maps → Early Endgame → Mid Endgame (CI) → Full Screen AOE (LIVE)**, plus Uber Endgame. Mid Endgame is the default tab. The tabs change the variant blurb and the Equipment, Skill Gems and Passive Tree sections; everything else stays the same.

| # | Section | Words | Prose or widget |
|---|---|---|---|
| 1 | Build Overview | 421 | Prose. A video index, "Why Martial Artist" (~170), 4-line campaign-reward picks, a vendor regex, and the "Order of Following Versions" line |
| 2 | Strengths and Weaknesses | 26 | List: 5 pros, 1 con |
| 3 | Build Variants | 2–68 per tab | Tabs plus a short blurb that gives the swap trigger |
| 4 | Equipment | prose: 550–650 on endgame tabs, 50–100 on leveling tabs | Widgets: item cards with the full affix list on hover (roll ranges, tier labels like P2/S1, runes), a trade-search icon on each card, and a numbered slot upgrade order. Prose covers weapon, gloves, body, boots, amulet, rings, belt and jewels |
| 5 | Skill Gems | prose: 35–613 per tab | Widgets: gem link panel (10–12 groups), Str/Dex/Int requirements, numbered gem order (up to 44 steps). Prose: how to play, fitting the auras, the bossing combo, charge generation, Trinity, Rend |
| 6 | Passive Tree | 4–272 | Interactive tree widget, points-left counter, ascendancy order and reasons, notable directions |
| 7 | Quest Rewards | ~117 | Site widget. Three choices are "Not Specified"; the prose picks in section 1 fill them |
| 8–9 | How it Plays / How it Works | 36 / 41 | Prose. "How it Works" is only the Chaos Inoculation mana-flask warning |
| — | Video Guide, PoB code, build-file download, comments | — | Widgets |

**Totals:**
- The default tab shows about 2,050 prose words plus about 400 words of widget labels.
- All 8 tabs together hold about 7,800 prose words. After removing duplicates it's roughly 3,500–4,500 unique words; typo drift between copies makes the count fuzzy.
- About 550–650 words of gear prose are pasted into 5 tabs with small differences.
- Leveling (4 tabs) is about 1,600 unique words, mostly charge-generation mechanics. That compares with about 1,010 in our outline: Leveling, Route and Timing together.

### 2. Topics and how specific they get

- **Leveling.** Split by level band, not by act. It covers skill swaps (spear → unarmed Storm Wave at level 23–25 → Whirling Assault at campaign end), with a link setup and an attribute total for each tab. It has no act route, boss order, currency habits or respec gold.
- **Gem timing.** It's in prose: "First support you get should be Rage I". There's a full support order, and level caps: "DO NOT Lvl up Herald of Ash higher than Lvl 4."
- **Tree.** It names the notables to path to, with a fallback ("Look into Conservative Casting if you would have mana problems"). It also has don't-yet rules: "Start getting Crit nodes ... only when you are 50+ lvl."
- **Gear.** Affix priorities per slot, mostly without numbers. A few thresholds: 35% movement speed, at least 60 Spirit on the amulet, +3 melee skills. The examples are labelled as examples: "GEAR ABOVE SHOULD BE USED AS THE EXAMPLE OF STATS YOU MIGHT NEED". The Full Screen tab instead says "ALL ITEMS ABOVE ARE THE ONES I'M USING MYSELF RIGHT NOW".
- **Uniques and budget.** Budget is never given in currency. Gating is by words: "If you have a big Budget - Mageblood"; Headhunter "go for it only in Uber Endgame"; Ailith's Chimes "is too expensive and is NOT available early on".
- **Defences.** Energy shield plus evasion and deflection, and Chaos Inoculation (the keystone that trades away life). There are no resistance figures and no max-hit figures. The one number is the CI gate: "at least 4-5k is needed". The guide adds Ghost Dance for ES recovery.
- **Flasks and charms.** Only two things: Shavronne's Satchel needs an Instant-recovery flask, and the CI mana-flask trap.
- **Crafting.** Pushed to two videos. The text gives affix targets, including "Arcane Surge on Crit (It is Desecrated Modifier)".
- **Atlas.** None. There's a "What to FARM" row of five video links.
- **Bossing.** A setup-then-burst sequence: cull the bells with Killing Palm "perfectly BEFORE boss fight", then Charged Staff, then Hollow Form.
- **FAQ.** No FAQ section. Questions are headings placed inside sections: "Is Chaos Inoculation Necessary?", "How to fit ALL Auras?", "Hollow Resonance vs Runic Meridians?"

### 3. Voice and judgment

- **Mostly gut feel.** I counted about 12 numeric thresholds in roughly 4,000 words. Typical feel lines: "Usually x3 Flat Elemental dmg is better"; Hollow Resonance "is not hitting that often since AoE of it is smaller".
- **First person throughout.** "Ascendency Order That I will Use", "I'm not sure if the rend part will be necessary". "We" is used for the build.
- **Uncertainty is stated once and paired with what to do:** "I will keep it in the setup until in game tests... If it will not work properly, just drop it and get rapid attacks instead."
- **No tutorial content.** Mechanics come up only where the build uses them, such as the ascendancy bells being "always Primed for Stun, can be culled and hits against them are ALWAYS crits". A few generic gear lines would fail our swap test ("Take Resistances to the cap").
- **Rough edges:**
  - Pre-league speculation is still in ("After the reveal... looks like").
  - The ascendancy order differs across three places.
  - Act 3-6 tells you to generate charges with Lingering Illusion, but its gem panel doesn't include it. A commenter asked exactly that.
  - A leftover line mentions a "Bow" tree.
  - Caps, ❗ markers and typos throughout.

### 4. What it does that Fubgun's didn't, and what amendment 2 lacks

The Fubgun side comes only from the worklog's adopt list, which is fallbacks, support priority, slot buy order, campaign practicals and gated variants. I didn't read his guides.

1. **Rules for running short of a resource.** "at least 60 Spirit on your Amulet to use all auras. If you dont have enough, drop Herald of Ash"; "If you dont have it - drop Wind Dancer". These are fallbacks keyed to spirit, ES or damage, not to a gear slot.
2. **A traps list.** "% mana recovered is removed from Life'. It literally one shots you"; "Way of the Mountain NOT working with Chaos Inoculation"; "Make sure you DONT have weapon equipped".
3. **A one-line ladder at the top.** "Lvl 1-23 → 23+ Unarmed → Act 3-6 → Campaign End → Early Endgame → Mid Endgame → Full Screen AOE".
4. **Hold rules.** Gem level caps and delayed investment (the Herald level-4 cap, crit at 50+).
5. **A numbered upgrade order for every stage, leveling included.** In Lvl 1-23 the order is boots, amulet, rings, spear. We only have a buy order on the budget rung.
6. **Either/or choices with the deciding factor.** "Hollow Resonance adds some damage and Runic Meridians for QoL and Defense."
7. **A gate inside a rung.** CI only at 4–5k ES.
8. **Item status.** It says whether the items shown are stat examples or the author's own.

### 5. Proposed changes to amendment 2

| # | Change | Why (from this guide) | Verdict |
|---|---|---|---|
| A | **G1 rule "each caveat once" (where the reader acts on it):** add that each caveat ends with its fallback, "if this doesn't hold, do Y". | The Thrill of the Kill and Rend caveats each come with a drop-and-replace instruction. | Clear improvement, no word cost |
| B | **G1 §5 Priorities:** add a "When you're short" line covering spirit, mana, attributes and the defence threshold, and what to drop first. | The 60-spirit/drop Herald, drop Wind Dancer and 4–5k ES rules. PoB can compute reservation and requirements, so these are plan numbers that can be checked. | Clear improvement, about +40 words |
| C | **G1 §11 How to play it, or §13 FAQ:** add 2–4 "Traps" bullets for interactions that break or kill the build. Each needs a claim, since G3 already requires claims for mechanics the build depends on. | The mana-flask, Way of the Mountain, Satchel and no-weapon warnings. | Clear for traps PoB can confirm (keystone or node conflicts); judgment for game behaviour PoB doesn't model |
| D | **G1 §2 Your PoB file:** list the loadouts as an ordered ladder, each with a 3–6 word trigger. | The "Order of Following Versions" line. | Clear improvement, about 25 words |
| E | **G1 §2:** add one sentence saying the file's items are stat examples ("match the affixes, not the item"). | The "EXAMPLE OF STATS YOU MIGHT NEED" label. | Clear improvement |
| F | **G1 §8 Entering maps and G5 (the 5-divine bridge rung):** add a numbered slot upgrade order within the 5 divines, as §9 has for the budget rung. | Every tab has the numbered Equipment Priority list. D1, our endgame designer, already prices the entering-maps slots. | Clear improvement |
| G | **G1 §4 Gem and ascendancy timing:** allow "hold" rows (level caps, delayed investment) with the reason. | The Herald level-4 cap, crit at 50+. | Judgment call: the plan's gem levels already encode this, but the reader can't tell it's deliberate |
| H | **G1 §5 or §13:** allow at most one or two either/or picks stating the deciding factor, quantified as DPS versus survival from PoB. | Hollow Resonance vs Runic Meridians; "Is CI necessary?" with its ES threshold. | Judgment call: each adds claims and cost |

G4 (the not-a-tutorial rule) needs no change. This guide follows it almost exactly, which supports keeping it.

**Don't copy:**
- **Video offloading.** Crafting, Trinity and "when to go CI" live only in videos. Our text must stand alone.
- **The "What to FARM" atlas links.** Out of scope, and already held back.
- **The vendor regex.** We can't check it against the game's search syntax.
- **The "make a Huntress and stash the spear" trick.** General league-start know-how that depends on the player's account; not build data.
- **Tier labels on items and auto trade links with stat minimums.** Already held back (lookups can't supply tiers; links wait for WU-48). The guide's own links show the upkeep cost: the item-card links point at league "Forbidden Rites" while its saved searches point at "Runes of Aldur".
- **Gear prose copied into each tab, and three different ascendancy orders.** This is what "the guide renders the plan" prevents. Keep that rule.
- **Wording.** Speculative "will test and update" hedges, caps and emoji emphasis.
- **Numberless defence claims** ("Tanky with ES + Evasion Combo"). Several comments ask for benchmarks ("Quarterstaff ... 12k DAMAGE and my Whirling Assault just 3k... is that normal"). That argues for keeping our survival verdicts and DPS lines.
- **Sidegrade variants** (Full Screen AOE, Uber). Each would mean another endgame design pass and more verifier cost.

### 6. Video links, in page order

**Byline:** https://www.youtube.com/@ronarray (channel icon, no text).

**Build Overview** (the same on every tab):
1. https://youtu.be/rQ0kydfdesI — "Step by step video", under Crafting Guides "▸ All Armour + Amulet".
2. https://youtu.be/RdKoRIffBBE — "Step by step video", "▸ Weapon + Rings".
3. https://youtu.be/i6vzzrQIJ6w — "STEP BY STEP Leveling - youtu.be/i6vzzrQIJ6w".
4. https://youtu.be/SKTko6cEckQ — "▸ T15 Update + Whirling Swap".
5. https://youtu.be/EbyMEBDURpE — "▸ Trinity & Hollow Form Explained".
6. https://youtu.be/WLT5_uRXR60 — "▸ When to Go CI and How to Be TANKY".
7. https://youtu.be/L38rrIb9TsM — "▸ How to get FREE Trinity Aura".
8. "What to FARM" row:
   - https://youtu.be/spCSg_X3xbE "Ritual Guide"
   - https://youtu.be/QsmXcmaDD1M "Breach Guide"
   - https://youtu.be/Vd5Uhba-2sU "Abyss"
   - https://youtu.be/UfJflMmJ1BM "Boss Rush"
   - https://youtu.be/TXbVXloQDzQ "Expedition"

**Build Variants blurb** (changes by tab):
- Mid Endgame and Early Endgame: https://youtu.be/EbyMEBDURpE, "Full IN DEPTH Guide + tech demonstration".
- Lvl 1-23, 23+ Unarmed and Act 3-6: https://youtu.be/i6vzzrQIJ6w, link text "video" in "STEP BY STEP Guide for leveling + tech demonstration - video".
- Campaign End / Early Maps: https://youtu.be/SKTko6cEckQ, "Guide WHEN and HOW to swap Whirling Assault from Hollow Palm" and "Please Watch it to understand breakpoints better."

**Equipment:**
- Mid Endgame: rQ0kydfdesI ("Crafting Guide for All Gear + Amulet - Step by Step") and RdKoRIffBBE ("Crafting Guide for Weapon + Rings - Step by Step").
- Early Endgame, Full Screen AOE and Uber: the same two, as bare URLs.
- Campaign End: rQ0kydfdesI as "📝Crafting Guide".

**Skill Gems** (Mid and Early Endgame): https://youtu.be/EbyMEBDURpE twice, "Watch this to not mess Trinity up" and "Watch this video to understand Trinity better".

**Video Guide section** (embedded, every tab): https://www.youtube.com/embed/j0xi8FhKYVQ, titled "[PoE 2] SCREEN WIDE SPINNER! - Martial Artist Build - Whirling Assault Monk - Path of Exile 2 0.5".

**Other outbound links:**
- **twitch.tv/ronarray:** in the byline and the intro ("Right now I'm playing this build myself").
- **pathofexile.com/trade2:**
  - a saved search for the Absent Amulet ("Follow that trade link (change league if needed)", .../Runes%20of%20Aldur/BgvVg9yWt8);
  - a saved search for Megalomaniac on the Full Screen tab (.../ky6G2X33h5);
  - auto-generated per-item searches on every item card (15 on the Mid Endgame tab, league "Forbidden Rites", stat minimums, sorted by price).
- **form.typeform.com:** Mobalytics' "Become a Creator" (site chrome).

Mobalytics' own build-file download and PoB code copy are on-site, not outbound.
