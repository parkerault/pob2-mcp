# Amendment 8: finding the build's engine

**Status: APPROVED by the user, 2026-10-18.** Choices 1, 3 and 4 take §18's recommendation (the rival every run,
the structure check in R1b, the index written once per pin); choice 2 takes the alternative: "Build the beast
library, and approve the grants and requests". §4 carries the user's two points on tamed beasts from the same
message. Drafted and revised the same day after an independent review and its
re-check (2 blockers and 27 should-fix findings, resolved below). It carries:
- the comparison's remedies the user sent here (`../studies/2026-10-17-varashta-comparison.md`, "the comparison",
  §7.2 remedies 1, 3–9, 11 and 13, and §6's engine-lens list);
- the tamed-beast scope the user added on 2026-10-17 (work-log, "the engine-lens amendment's scope gains tamed rare
  beasts");
- the Powered by Verisium miss (`../studies/2026-10-17-varashta-run-feedback.md`, "the feedback study", §2.2);
- measured clear speed for card skeletons (the WU-81 verdict, work-log 2026-10-18).

It is written against spec v1.6 (folded 2026-10-18, through D-397). Paths are from the
repository root, except stage files (`R1a.md` and so on), which are under
`.claude/skills/build-guide/references/stages/`.

**Names.**
- A build's **engine** is what makes its damage work: the resource or condition the damage source consumes (Chilled
  Ground for Navira's Fracturing) and the **supply** that makes it (a freezing nova, a tamed beast's trail, Powered by
  Verisium's infusions). A card's Chain section already states it: `Consumes or requires: <X>, supplied by <Y>`.
- A build's **structure** is its engine plus the choices that shape the whole build: the weapon's job, the number of
  minion types, a second damage source. Tuning picks the best support, passive or item for a given structure.
- A **rule changer** is a node, keystone, gem or unique that changes how a standard mechanic works (Way of the
  Stonefist turns the gloves you equip into Fists of Stone with stronger modifiers).
- The **obvious build** is what an average player would build first with the brief's skill and ascendancy.
- A **rival** is a card written with fresh context, whose one job is a different structure that clears faster.
- From the pipeline: a **card** is one candidate build (`cards/<id>.md`); its **brainstorm half** is what the
  researchers write, its **verification half** what R1b (the step that compiles a card to test it) adds. A card's
  **skeleton** is R1b's small plan for that compile. The **sniff test** deals a card only when a lookup confirms every
  load-bearing link in game text (R1a-assemble step 3, D-287). `b` and `n` are the budget and non-budget endgame
  variants.

## 1. The user's direction

- **Local maxima.** The pipeline settles on its first structure and makes no lateral moves; tuning the wrong
  structure wastes tokens (2026-10-18). An average player's first thought for a minion build is "sceptres and lots of
  Spirit", and PoB can't supply that thought.
- **Clear speed is the judge.** Players judge a build by "how quickly it can clear screens of enemies, which is a
  combination of damage, AoE, and how fast the player can move from pack to pack". Bosses are under 5% of play time
  and are a floor.
- **New content comes from the community.** poe2db is the user's go-to: exhaustive, and new league content lands
  there quickly. Agreed: a committed per-league digest that every brainstorm reads first (2026-10-18). poe2wiki
  refuses agents behind a bot shield and stays out; the comparison's other route, video transcripts, was set aside by
  that choice.
- **Rule changers.** Way of the Stonefist is "something that a naive researcher wouldn't think to look for". Agreed:
  one index of rule-changing nodes, keystones, gems and uniques, searched by mechanic and never loaded whole. "Most
  uniques sacrifice the resistances, life and defences that rares provide": say it once, and list only explicit
  penalties per item. A unique's price is popularity plus rarity, not popularity.
- **Tamed beasts** ("Yes", 2026-10-17): a table of rare monster modifiers, the beast library in the server, a library
  entry and a `docs/build-guide/pob-gaps.md` entry.

**What the run showed** (the comparison §3, §7.1):

- Navira's build beat ours about ×2.3 on a pinnacle boss and ×1.6 on map monsters. Almost none of the gap is tuning:
  where the ground comes from, how many minion types the build runs, what the weapon is for, and a second djinn.
- The research files held Muster, the +4 sceptres, Kelari and Encroaching Ground. Nothing combined them.
- Powered by Verisium was missed by the search method. The infusion lookups asked for "Cold Infusion" (five times)
  or "Infusion Remnant" (twice), never the whole "Infusion" family, and two researchers saw "Verisium Infusion" in a
  result and didn't follow it.
- Five of the round-1 deck's eight cards ran on one engine (the feedback study §1).
- Our weapon served the engine's freeze (a wand), which gave up the sceptre's Spirit and minion levels, and with them
  the army.
- **The library didn't prevent it.** It already says "give it the standard kit before calling it weak" (brainstorm
  question 9) and has a Muster entry ("Filler to satisfy a count"). The researchers read it whole and still missed
  the army. So this amendment's remedies are steps the pipeline must take (D-403, D-406, D-408), with the library in
  support.

## 2. D-400: a league digest from poe2db

**What it is.** A committed file per league or patch section on poe2db, `data/league/<slug>.md`, listing what is new:
gems, uniques, items other than plain currency, and the new ascendancies and passives. Facts about the game go in
`data/`, beside the campaign and enemy data the stages already read; how to reason about them stays in the skill.

- **Each entry:** an id (its name as a slug), name, kind, tags, full text, URL, the date fetched, and whether the
  PoB pin knows it.
  - Ascendancies and passives are names and URLs only: the league homepage lists them, but their text needs one
    request each. An online researcher may fetch one from poe2db when a card needs it (an allowed host, D-171).
- **Head and body.** The head is one line per entry: name, kind, and the first clause of its text. At 0.5.4 ("Runes
  of Aldur") that is about 150–200 lines (57 gems, 50 uniques, the non-currency items, the ascendancy and passive
  names), about 2,500 words. The body holds the full text, one entry per block, for Grep: about 6,000–8,000 words
  once currency is cut.
- **Who reads it.** Every R1a researcher reads the head whole and Greps the body by mechanic, and so does the rival
  (D-408). Offline runs read it too, since it is committed.
- **Its text confirms a link.** This amends the sniff test (D-287), which today needs a lookup: an entry's text in
  the digest counts as game text, cited `data | league/<slug>.md#<entry-id>`. Each entry carries an id line, and
  the run checker learns to resolve a Markdown data file by those ids (WU-89); today it reads only JSON `facts`
  files.
- **Not in the pin.** An entry the pin doesn't know can't be compiled. A card whose named damage source or
  load-bearing link rests on one is dealt as "can't be finalized yet" (D-303), and the gate says why. Its line in
  the deck reads `waits on the pin: <entry>`. If the user picks it, R1b compiles nothing, as for a damage source
  that isn't a skill: its verdict carries the finding `not-in-pin` ("not compiled: <entry> isn't in the PoB pin"),
  and its dossier row reads "can't be finalized yet: waits on the pin".

**The script,** `.claude/skills/build-guide/scripts/league-digest.mjs <slug>`:

- fetches the section's list pages (`https://poe2db.tw/us/<slug>_gems`, `_uniques`, `_items`) and the homepage's
  league section: serial, at least 3 s apart, the server's User-Agent, no cookie, one retry after 60 s on 429 or 5xx,
  nothing fetched twice. robots.txt disallows only `/*/marked` and `/*/markdown_history`;
- parses the HTML exactly, not through WebFetch's summary;
- checks each name against the pinned data files (`vendor/.../Data/`) for the in-pin flag;
- writes the digest, and prints the entries added since the last one;
- with `--reflag <slug>`, offline, re-checks only the in-pin flags of a committed digest, for a pin upgrade.

**Who fetches.** The user runs the script when a league or patch lands; nothing runs it on a schedule. With
`--from <folder>` the script reads saved pages instead of fetching, which its tests and the first digest use: WU-84
builds the first digest from the league pages the coordinator's probe saved on 2026-10-18, with no request. No build
agent touches the network.

**Staleness.** At a run's start the runner prints the digest's newest section and its fetch date
(`head -3 data/league/<newest>.md`), so a stale digest shows.

## 3. D-401: one index of rule changers

**What it is.** Four committed files in `data/rules/`, built from the pinned data:

| File | What | Read how | Size |
|---|---|---|---|
| `nodes.md` | every ascendancy notable (22 ascendancies, 209 notables) and keystone (33): one line each, rule changers marked | the brief's ascendancy's section and the keystones, whole | about 250 + 700 words |
| `uniques.md` | the rule-changing uniques among the pin's 435 | Grep only | |
| `gems.md` | gems whose text changes a rule ("in place of", "count as", "instead") | Grep only | |
| `pairs.md` | joins: what one entry creates against what another pays off on | Grep only | |

**A line in `nodes.md`:**

```
- Way of the Stonefist (39595, Martial Artist) [rule] — equipped gloves become Fists of Stone, with stronger related
  explicit modifiers. creates: item-modifiers | pays off on: glove-slot | PoB models it: no
```

A node that changes no rule gets its line without `[rule]` and without the tags. The node's own lines come from a
lookup, not from the index.

**A block in `uniques.md` or `gems.md`:**

```
### <Name> (<slot or gem kind>, level <n>)
- Rule: <the rule it changes, in a sentence>
- Lines: "<the lines that change it, verbatim>"
- Creates: <families> | Pays off on: <families>
- Penalties: <explicit penalty lines only, or none>
- PoB models it: <yes | partly | no>
```

- **The vocabulary.** Creates and Pays off on use a fixed list of mechanic families (infusion, chilled-ground,
  minion-count, minion-death, spirit, ward, the three charges, the ailments, and so on), defined in
  `data/rules/vocabulary.md` (written by the coordinator before the build, since three units use it). A family, never one resource: "infusion", not "cold-infusion" (D-404).
- **Penalties.** Explicit ones only ("-40% to Fire Resistance", "you can no longer regenerate Life by any other
  means"). The head of `uniques.md` says once that most uniques give up the resistances, life and defences a rare
  provides.
- **No price.** A unique's price is popularity plus rarity; it isn't evidence that players build around it.
- **PoB models it** comes from `check_model_coverage`. For a unique PoB doesn't model, the compile measures the
  defences it gives up but not what it adds, and the entry says so.
- **Nothing legacy.** Gems PoB marks legacy and uniques it says are no longer obtainable are left out (D-384,
  D-395).

**How it is built,** once per pin, and again at a pin upgrade (a fifth step in `CLAUDE.md`'s "Upgrading the PoB2
pin"):

1. A script lists the candidates from the pinned data: every ascendancy notable and keystone, every unique, and
   every gem whose text matches a rule-change phrase, less the legacy and unobtainable ones.
2. Agents write the lines and blocks in batches, from the game text and `check_model_coverage`. A unique or gem
   with no rule change gets no block.
3. A script checks every line's and block's format and vocabulary, and joins Creates against Pays off on into
   `pairs.md`.
4. An independent verifier checks a sample against the game text.

The one-time cost is about 0.6–1M tokens per pin, mostly step 2.

**Who reads it.** R1a researchers (the tree focus reads its ascendancy's section and the keystones; the items focus
Greps `uniques.md`; every focus Greps `pairs.md` for its engine's families), D1-build before designing `b` and `n`,
and the rival.

## 4. D-402: rare monster modifiers and the tamed beast

A tamed rare beast keeps up to four of its monster modifiers. Navira's guide tames one with Frozen Ground Trail, so
the beast makes the Chilled Ground the build consumes. PoB has no table of rare monster modifiers and no way to give
a companion one, and our server doesn't read or set PoB's beast library.

**The user's two points** (2026-10-18):
- "The Varashta build depends on a mod that doesn't have any stats to model, but many (most?) of the mods do modify
  stats (haste increases movement and attack speed for allies, for example, and is usually the mod that most players
  prioritize)."
- "Most minions reserve a flat amount of spirit, but tamed beasts always use a percentage, so they change the
  calculus for spirit stacking." PoB agrees: a companion's reservation is its monster's `companionReservation`, a
  percentage (`Modules/CalcDefence.lua:204`), from 13.8% to 56.1% across the 619 monsters in `Data/Spectres.lua`,
  32.7% at the median.

- **A table of rare monster modifiers,** `data/monsters/monster-mods.md`, from poe2db. For each: an id, name, its
  stat lines as the game words them, whether a tamed beast can keep it, how a plan models it (below), and Creates
  and Pays off on in the index's vocabulary, so `pairs.md` joins it (a trail of ice creates chilled-ground).
  - **The source,** found by the coordinator's probe (three requests, 2026-10-18):
    `https://poe2db.tw/us/Monster_Modifiers` lists 268 modifiers with their stat lines ("Hasted: 30% increased
    Movement Speed, 30% increased Attack and Cast Speed"; Haste Aura; Trail of Ice); `https://poe2db.tw/us/Tame_Beast`
    lists 178 of them under its own heading, taken to be the ones a tamed beast can keep (WU-86 confirms it), and
    295 tameable beasts. Whether the guide's "Frozen Ground Trail" is poe2db's "Trail of Ice" is WU-86's to confirm.
  - **How a plan models a kept modifier,** one of three ways, written in the row:
    - **stats:** its lines go in as custom modifiers (D-293), each an estimate the record marks: an aura or a buff
      that reaches the player as player lines, and one that reaches minions as `Minions have …` lines;
    - **condition:** what it supplies is a config entry, as ground is today (enemies on Chilled Ground);
    - **none:** PoB can't take it; the card says so, as for any unmodelled line.
  - **Read by Grep,** like the index. The scope of 2026-10-17 had `lookup_game_data` answer questions about the
    table; Grep does the same job with no change to the tool, which would otherwise need the user's HG-12 call (any
    change to the tool surface or a tool's contract).
  - **Its text confirms a link** for the sniff test, as the digest's does (`data | monsters/monster-mods.md#<id>`).
    A card whose supply is a beast's modifier
    can be compiled: the condition the beast supplies is a config entry, as it is today (enemies on Chilled Ground),
    and the beast itself is a link PoB can't model.
- **A library entry:** "a tamed rare beast": what its kept modifiers supply (a condition, such as Navira's ground,
  or stats, such as Haste Aura's speed for its allies), and its percentage Spirit cost (D-409).
- **PG-56** in `docs/build-guide/pob-gaps.md`: PoB has no rare monster modifiers.
- **The beast library in the server** (§18, choice 2: built). A plan names the companion's species and its kept
  modifiers (`companion: {species, mods: [<table ids>]}`). The compile sets PoB's beast library from the species, so
  the beast's damage, defences and Spirit reservation are measured, and writes each kept modifier as its row says:
  stats as custom modifiers, a condition as a config entry. The record names the beast's reserved Spirit. The user
  granted HG-12 for the schema field and the compile (§18).
- **The percentage cost reaches the design.** The minion kit (D-403) and the structure check's counts step (D-406)
  say that a beast's Spirit cost grows with the Spirit a build stacks, unlike a flat-cost minion's, so each point of
  Spirit buys a little less once a beast is out.

## 5. D-403: the obvious build is always in the deck

- **Standard kits.** The pattern library's brainstorm question 9 says "give it the standard kit before calling it
  weak", but never says what a kit is. A new section, "Standard kits", gives one short entry per archetype: what an
  average player knows to use, and the archetype's big levers. For minions: a sceptre, lots of Spirit, minion levels
  on the helmet, amulet and focus, and more minion types; the levers are minion levels, Spirit, minion types and
  minion damage supports. Each kit line cites a study, a lookup or the user. The user reviews the kits before they
  bind, since they are meant to be what an average player knows (WU-90).
- **The ascendancy's own design is a prior.** The tree focus reads its section of `nodes.md` and says what the
  ascendancy is built to do (Varashta's nodes are djinns, so two djinns are the intended play).
- **The obvious card.** In round 1, the mechanics researcher (`a`) writes the obvious build as its first card,
  `r1-a-1`: the brief's skill on its ascendancy, with the archetype's standard kit and the ascendancy's intended
  play. Its pitch carries `- Obvious build: <the kit it follows>`.
  - With no skill in the brief, it is the obvious build for the brief's playstyle. A brief with neither ("surprise
    me") has no obvious card.
  - Researcher `a`'s other two cards keep the existing rule: at least one is under-played.
  - **The seed card moves to researcher `b`** (WU-82 built it into `a`'s prompt), so no researcher has all three
    cards fixed.
- **Every other card answers it.** A card's "How it clears" says how it clears faster than the archetype's standard
  kit, or why it's worth picking anyway. The researchers write in parallel, so they compare against the kit, not the
  obvious card itself.
- **Dealt whenever it passes** the identity and sniff checks (R1a-assemble steps 2 and 3), counted in the round's
  6–9 cards.

## 6. D-404: search a supply by its family, and follow strange words

When a card's chain consumes a resource or a condition, the researcher's supply search covers:

- **the whole family and its substitutes:** `lookup_game_data {mode: "mechanic", query: "Infusion"}`, not "Cold
  Infusion"; the family's name in `data/rules/pairs.md`; and the digest's body;
- **every source kind:** gems, uniques, passives, ascendancy nodes and the monster-modifier table;
- **unfamiliar terms:** a term in a result the researcher can't place ("Verisium Infusion") gets one lookup before
  the search ends.

The research file gains a `## Supply search` section per consumed resource: each supplier found, the lookup or file
that found it, and whether a card uses it, and if not, why. R1a-assemble reads these sections (Grep `^## Supply
search` and the lines under it) for the deck's "Found, not used" list (D-392).

## 7. D-405: no more than half a round on one engine

- **The deck line names the engine.** R1a-assemble reads each dealt card's `Consumes or requires … supplied by …`
  line and writes its deck line's `engine: <family> from <family>` in the index's vocabulary (D-401), so cards that
  word the same engine differently still match. Two cards share an engine when both families match.
- **The rule.** R1a-assemble's step 5 (deal 6–9 cards) deals at most half of the round's cards on one engine,
  rounded down: 4 of 8 or 9, 3 of 6 or 7. It deals the ones that differ first and puts the rest under "Not dealt" as
  `the round already holds <n> cards on this engine`.
- **It yields to the minimum.** When the rule would leave fewer than 6 cards, R1a-assemble deals the fewest extra
  cards that reach 6 and the round is short: `short: <n> cards share one engine`.
- **It yields to the user.** When the user's note for the round asks for one engine, the rule doesn't apply to that
  engine, and the deck's header says so.
- The deck's "How they differ" header names each engine and its card count.

## 8. D-406: the structure check, on paper, before the skeleton

R1b gains a step for each card the user picked to verify. It runs after R1b's two opening checks (the gate's change
and the ascendancy lock) and before tree targets (step 1). It costs a few paragraphs of arithmetic and no compile.
R1b reads the library's "Standard kits" entry for the card's archetype for it.

1. **The levers.** For the archetype's big levers (D-403), what the card pulls and what it leaves. "100 Spirit on a
   minion build" is one line.
2. **Flip the assumptions.** The card's two or three load-bearing assumptions, each reversed in a paragraph: "the
   ground needs a freeze" leads to the infusion search; "the weapon is a wand" leads to a sceptre and the army; "one
   djinn" leads to Kelari.
3. **Counts.** What grows with a count (Muster with minion types), and what pays for a bigger count (a sceptre's
   Spirit). The arithmetic is rough on purpose: Muster at eight types is about 7% × 8.
4. **Premium slots.** What each premium slot serves. A slot that props up the engine rather than the damage is a
   lead: search for a supply that frees it (D-404).

It writes the card's `### Structure check`, a new heading in the verification half. When a flip beats the card on
paper, the section's last line reads `- A stronger structure? <the flip, in a sentence, and the rough multiplier>`.
The verification gate's display shows that line under the card, and the user can make a new card from it there
(D-391).

**In D1-build,** before designing `b` and `n`, step 1 again with the compiled figures. Each lever it leaves unpulled
is returned as `lever unpulled: <lever>: <why>`, which D1-finish writes as a `reason` claim on the first endgame
stage, as it does `left out:` lines today (D-396). The verifier checks those claims like any other.

## 9. D-407: clear speed is measured at every compile, and leads

- **Measured on skeletons.** The record's rough `clearSpeed` (D-353: a band from the clear skill's area, assuming one
  use kills a normal monster) is measured on card skeletons as well as the endgame variants; campaign stages still
  have none. Today `stageMeasures` in `src/plan/compiler.ts` measures only the variant stages. The verification gate shows the measured band where
  WU-81's fix round now shows the card's estimate.
- **Pace beside it.** The record shows the player's movement speed beside the band. Time to first damage on a new
  pack isn't in PoB; the card's "How it clears" estimates it, marked as an estimate.
- **No area, said plainly.** PoB gives some attacks no radius (a Skeletal Warrior's strike), so the band reads "slow"
  for builds that may clear well, such as minions that strike in melee. When the clear skill has no area, the display reads `slow (PoB gives no area)`, and
  the card's estimate leads.
- **The order.** The cards' pitches already lead with "How it clears" (D-392). The verification and design gates'
  displays now lead with clear speed and movement speed, then the boss floor: at the verification gate the card's
  Bosses line, since skeletons have no Arbiter check; at the design gate the Arbiter check, as today.
- **Still rough.** The user's answer of 2026-10-11 (amendment 4, Q2: a rough clear speed is fine, not worth much
  effort) still sets how it's measured. What changed on 2026-10-18 is how much it counts.
- **Overriding PoB's ranking.** A designer may choose a support, passive or item that PoB ranks lower, for what PoB
  can't measure (area, supply rate, pace). D1-build returns it as `override: <PoB's first choice> → <ours>: <why>`,
  and D1-finish writes it as a `reason` claim, like D-406's levers. Encroaching Ground in the Varashta run is the
  example: found, never used, because the ranking was by DPS.

The record's added fields on skeleton compiles change `compile_plan`'s output, so they need the user's HG-12
call (§18, grants).

## 10. D-408: a rival with fresh context

**When.** Once per run, in the first verification round: after R1b has verified the picked cards and R1b-assemble
has written the dossier, and before the verification gate. Stage `RV`, a `build-guide-researcher`.

**What it reads.** The brief, the dossier (`dossier.md`: one row per verified card, with its synergy in a few words,
its DPS, Life, EHP and, under D-407, its clear speed), the pattern library, the digest and the index. Never the run's
research files, cards or interview notes, so it doesn't share their blind spots.

**Its job.** One card, `cards/r<k>-x-1.md`, whose structure differs from every row in the dossier and that clears
faster on paper, with the arithmetic. Or the one line `no faster structure found`, with what it tried.
- The brief's fixed pieces bind it: a named ascendancy or skill stays. What the brief leaves open is open to it.
- Its card is a normal card: the identity, pitch, chain and links tables, the lookups that confirm them.

**After it.** The rival's card goes through R1b like a picked card. R1b first runs R1a-assemble's identity and sniff
checks (steps 2 and 3) on it, and stops with the failure code `not-dealt` when they fail. R1b-assemble then adds its
row to the dossier. The verification gate shows it beside the others, marked as the rival.

**The rules it amends.**
- **D-287's cap** of 3 R1b steps per verification round: the rival's R1b is outside it. The run checker's cap
  (`check-run.mjs`, the verification round's count) learns the `x` card.
- **D-235** (only the user starts a round) holds: the rival runs inside the verification round the user started, and
  only the user finalizes a card.
- A later verification round gets no rival. The user can ask for one at any gate; the runner then starts stage
  `RV` with the same reads, not a gate question step (stage Q reads the run's cards and research and writes no
  card).

**The cost.** One researcher, one R1b and a second R1b-assemble pass per run: about 150–170K output tokens, about an eighth of the lean run's
1.23M (WU-72: three R1a researchers spent 280K, two R1b steps 138K). If the rival finds no
faster structure, the pick is probably near the top before the expensive design steps. If it does, the tuning would
have been wasted.

## 11. D-409: the library's entries

Within the 10,000-word cap (D-381; the library is at 5,999 words). The library supports the steps above; it is not
the remedy by itself (§1). Every new or changed entry waits for the user's review before it binds, as the library's
maintenance rule asks (C-53, D-290).

**D-410 (the user, 2026-10-19; the coordinator chose the numbers): the Mobalytics review's changes, approved as
proposed, raise the library's limits.** The review's 17 studies (`../studies/2026-10-18-mob-*.md`) and its proposal
(`../studies/2026-10-18-mobalytics-proposals.md`) brought the library to 10,872 words, Standard kits to 3,100 words
and six entries to four or five examples. The library's cap is 12,000 words (`LIBRARY_WORD_CAP`), replacing
D-381's 10,000; Standard kits is about 3,000 words (AC-W74's band, 2,500–3,500) over fifteen archetypes, the ten
plus Companions, Shapeshifting, Plants, Shields and Automated loops, and the tamed beast's percentage Spirit cost
moves from the minion kit to Companions; an entry gives one to five examples (AC-W28). Each R1a researcher and
D1-build reads about 2K tokens more per run. Still a cap: the next review proposes within it or asks.

- **Brainstorm questions 11–14:** what does the obvious build do, and how is this card faster? What grows with a
  count, and what pays for a bigger count? What does each premium slot serve? Which rule changer touches this engine
  (`data/rules/pairs.md`)?
- **"Standard kits"** (D-403), about 1,200 words. Brainstorm question 9 points to it. **Amended by D-410:** about
  3,000 words, fifteen archetypes.
- **"A count as a multiplier,"** a new entry beside "Filler to satisfy a count", which keeps its support-colour and
  socket counters: a count that grows with minion types (Muster, At your Command) is worth building around, and
  Spirit pays for the types. Muster at eight types is about ×1.56 (the comparison §3 measures ×1.63). The two
  entries point to each other.
- **New shapes,** each with its search step, how PoB follows it and its cautions:
  - **Supply by family:** search a consumed resource by its family and its substitutes, and follow unfamiliar terms
    (D-404). Powered by Verisium and the beast's trail are its examples.
  - **Bank the resource:** a stored supply, such as infusions held between packs, clears faster than one made on the
    spot.
  - **A tamed rare beast** (D-402): its kept modifiers supply a condition or stats, and it reserves a percentage of
    Spirit.
  - **A rule changer:** Way of the Stonefist; how to use the index.

**A single-target answer on every card** (the comparison §6) is already a pitch line, "Bosses" (D-392); this
amendment adds nothing for it.

## 12. Where the files live

- **Facts** go in `data/`: `data/league/`, `data/rules/` and `data/monsters/`. They don't move if the skill splits.
- **How to reason** stays in the skill: the library, `lookups.md`, the stage references.
- `docs/build-guide/pob-gaps.md` stays where it is.
- The skill-split design (`docs/design/2026-10-18-skill-split.md`) moves the library and the reasoning files into a
  game-knowledge skill when that piece is extracted. This amendment's files are written so that move needs only path
  changes.

## 13. Where the inputs went

| Input | Where |
|---|---|
| Remedy 1, start from the obvious build | D-403 |
| Remedy 3, know what's new (poe2db) | D-400 |
| Remedy 4, the archetype's big levers | D-403 (the kits), D-406 step 1 |
| Remedy 5, flip the assumptions | D-406 step 2 |
| Remedy 6, what grows with a count | D-406 step 3, D-409 ("A count as a multiplier") |
| Remedy 7, what each premium slot serves | D-406 step 4 |
| Remedy 8, search by family | D-404, D-409 (supply by family) |
| Remedy 9, score clear speed | D-407 |
| Remedy 11, a rival with fresh context | D-408 |
| Remedy 13, rule changers | D-401, D-409 |
| §6: a single-target answer on every card | already the Bosses line (D-392) |
| §6: value what PoB can't measure | D-407 (the override) |
| Tamed beasts: the table, the server, the library, the gap | D-402, D-409 |
| The user's beast points: stat modifiers, percentage Spirit | D-402, D-403, D-406, D-409 |
| The feedback study §2.2: a library entry and a brief rule | D-409, D-404 |
| The deck's low variety (amendment 7's triage) | D-405 |
| Measured clear speed on skeletons (WU-81) | D-407 |
| Remedy 3's poe2wiki and video routes | set aside (§1) |

## 14. What changes

| Where | Was | Becomes |
|---|---|---|
| `data/` | campaign, economy and enemy data | adds `league/` (D-400), `rules/` (D-401), `monsters/` (D-402) |
| `R1a.md` | the library, then lookups | the library first (D-290), then the digest's head and the index (by focus); D-404's supply search and its section; researcher `a` writes the obvious card, `b` the seed card |
| `R1a-assemble.md` | deck lines without the engine; no research read; a link confirmed only by a lookup | the engine on each deck line in the index's vocabulary, D-405's rule, the Supply search sections read for "Found, not used"; the obvious card dealt when it passes; the digest's and the monster table's text confirm a link (D-287 amended); `waits on the pin` lines |
| `R1b.md` | opening checks, then tree targets | the structure check between them; the rival's identity and sniff checks; codes `not-dealt` and `not-in-pin` |
| `R1b-assemble.md`, dossier template | one pass per verification round | a clear-speed column; a second pass adds the rival's row |
| `D1-build.md` | `left out:` lines only | also `lever unpulled:` and `override:` lines |
| `D1-finish.md` | `left out:` lines as `reason` claims | the two new lines too |
| `stages/RV.md` | (none) | new: the rival |
| `SKILL.md`, `start.md` | (none) | the digest's staleness line at the start; the rival step before the verification gate; seed to `b` |
| card template | Pitch and verification half | `Obvious build:` (on one card); `### Structure check` |
| the researcher agent's description | stages R1a and Q | adds RV; its Read and Grep rules gain `data/league/`, `data/rules/`, `data/monsters/` |
| `check-run.mjs`, `run-log.mjs`, `render-audit.mjs` | (as built in M-18); `data` citations resolve JSON `facts` files only | card id letter `x`; stage `RV`; codes `not-dealt` and `not-in-pin`; the engine field and D-405; the structure-check line; the displays' new order; the verification cap's exception; `data` citations to the Markdown data files by entry id |
| `src/plan/compiler.ts`, `record.ts` | `clearSpeed` on variant stages only | on every compile record, with movement speed (HG-12) |
| the plan schema, `compile_plan` | no companion | `companion: {species}` if §18 choice 2 builds it (HG-12) |
| `patterns.md` | 5,999 words | questions 11–14, Standard kits, "A count as a multiplier", four shapes; under 10,000; each awaits the user's review |
| `CLAUDE.md` (the pin upgrade) | four steps | a fifth: rebuild `data/rules/`, and re-run `league-digest.mjs --reflag` on each digest |
| `docs/build-guide/pob-gaps.md` | to PG-55 (PG-54 and PG-55 from the M-19 fix batch) | PG-56 |

## 15. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-84 | 03 | The league digest (D-400): the script (with `--from` and `--reflag`) and its fixture tests; the first digest from the saved pages | — | low |
| WU-85 | 03 | The rule-changer index (D-401): the candidate script, the vocabulary, the format check and the join, then the entries (agents in batches), then a verifier's sample | — | medium: the largest content pass |
| WU-86 | 03 | Rare monster modifiers (D-402): the table from the two pages the probe saved, each row's model (stats, condition or none), PG-56 | — | medium: two pages to join |
| WU-88 | 02 | Clear speed and movement speed on every compile record (D-407): `compiler.ts`, `record.ts`, tests | — | low |
| WU-87 | 02 | The beast library (D-402): the plan schema's `companion`, the compile (the species, the kept modifiers by their rows), the measures, tests | WU-88 (the same files), WU-86 (the table's ids) | medium: a schema bump |
| WU-89 | 03 | The scripts: the obvious card's field, the `x` card id and the verification cap's exception, stage `RV`, codes `not-dealt` and `not-in-pin`, the engine field and D-405, the structure-check line, the displays' new order with movement speed, the `waits on the pin` deck line, `data` citations to Markdown data files | WU-88 | medium: every display again |
| WU-90 | 03 | The library (D-403, D-409): Standard kits, questions 11–14, "A count as a multiplier", four shapes. The user reviews every new entry | WU-85 | low |
| WU-91 | 03 | The skill text: every file in §14's skill rows, a new `stages/RV.md`, static tests | WU-84…WU-86, WU-89, WU-90 | medium: many files |

WU-83 is unused: it was only the M-19 fix batch's lane name. WU-84, WU-85, WU-86 and WU-88 can run in parallel;
WU-87 follows WU-88 and WU-86; WU-91 is last.

## 16. Acceptance criteria

- **AC-W70 (WU-84, D-400).** Script unit, on an HTML fixture written to the pages' structure:
  - the parser yields every entry with its kind, tags, text and URL; ascendancies and passives with name and URL
    only;
  - currency is left out;
  - the in-pin flag is right for one known and one unknown name, checked against a fixture name list, not
    `vendor/`;
  - no test touches the network.
- **AC-W71 (WU-85, D-401).** Script unit and static:
  - every line and block passes the format and vocabulary check, and a malformed one fails it;
  - the join pairs a fixture's "creates infusion" with its "pays off on infusion";
  - Way of the Stonefist's line exists with `[rule]` and "PoB models it: no";
  - no gem PoB marks legacy and no unobtainable unique appears;
  - `uniques.md`'s head carries the one-line penalty rule, and no block carries a price.
- **AC-W72 (WU-86, D-402).** Static and script unit: every row has its id, URL, stat lines, keep flag, model
  (`stats`, `condition` or `none`), and Creates and Pays off on in the vocabulary; "Hasted" carries its two speed
  lines and model `stats`; the ice trail carries model `condition` and creates chilled-ground; `pob-gaps.md` holds
  PG-56.
- **AC-P71 (WU-88, D-407).** Engine: a card skeleton's compile record holds `clearSpeed` and the movement speed; a
  clear skill with no area reads `slow` with the no-area flag.
- **AC-P72 (WU-87, D-402).** Engine: a plan naming a companion species compiles, and the record holds the
  companion's DPS and its reserved Spirit, which is the species' percentage of the player's Spirit (two Spirit
  totals give two reservations in that ratio); a kept `stats` modifier reaches the stage's custom modifiers marked
  as an estimate; a plan without a companion compiles as before.
- **AC-W73 (WU-89).** Script unit, on fixture runs:
  - the deck check fails a round that deals 5 of 9 cards on one engine, and passes it when the round is short for
    that reason or the user's note names that engine;
  - the display shows the obvious card's field and a structure-check line;
  - the run log accepts stage `RV`, the card id `r1-x-1` and the failure code `not-dealt`;
  - the checker passes a verification round of 3 picked cards plus the rival, and fails one of 4 picked cards;
  - the verification and design displays print clear speed and movement speed before the boss floor;
  - a deck line `waits on the pin: <entry>` passes on a card marked "can't be finalized yet", and an R1b verdict
    with `not-in-pin` and no compile passes;
  - a citation `data | league/<slug>.md#<entry-id>` passes when the fixture digest holds that id and fails when it
    doesn't.
- **AC-W74 (WU-90, D-403, D-409).** Static: the library holds questions 11–14, "Standard kits", "A count as a
  multiplier" beside an unchanged "Filler to satisfy a count", and the four new shapes, each with its search step;
  it stays under 10,000 words. **Amended by D-410:** fifteen archetypes, the tamed beast's line in the Companions
  kit, Standard kits 2,500–3,500 words, Filler's examples gain the Gemlings, under 12,000 words.
- **AC-W75 (WU-91).** Static, these files carry their new rules:
  - `R1a.md`: the pattern library first, then the digest's head and the index; D-404's three rules and the
    `## Supply search` section; the obvious card for `a`; the seed card for `b`;
  - `R1a-assemble.md`: the engine on the deck line in the index's vocabulary; D-405 with both of its exceptions;
    the Supply search read; the digest and the monster table as confirming text; `waits on the pin`;
  - `R1b.md`: the structure check between the opening checks and tree targets; the rival's checks and `not-dealt`;
    `not-in-pin` with no compile;
  - `D1-build.md` and `D1-finish.md`: `lever unpulled:` and `override:` lines, written as `reason` claims;
  - `stages/RV.md`: its reads, which name neither `research/` nor `cards/` other than its own card;
  - `SKILL.md`: the staleness line at the start, and `RV` after R1b-assemble and before the verification gate;
  - the researcher agent's description names RV, and its Read and Grep rules name the three `data/` folders.

**The first live test** is the next run. It should show the obvious card in the deck, a supply search that finds a
family's substitutes, and a rival that either beats the pick or fails to.

## 17. Risks

- **The index is one agent pass of judgment.** A wrong "creates" tag hides a pair. The verifier's sample catches
  some; a researcher still confirms every link with a lookup before a card is dealt.
- **poe2db changes its pages,** and the script's parser breaks. It fails loudly; the user re-runs it after a fix.
  The digest's text is the game's own, cited to poe2db's URLs, as the committed reference data already does.
- **More reading per researcher.** The digest's head, the ascendancy's section of `nodes.md` and the keystones add
  about 3,500 words (about 5,000 tokens) to each R1a researcher; the Grep reads are small.
- **The rival adds about 150–170K output tokens** to every run (§10).
- **Standard kits encode common wisdom,** which can go stale after a patch. They cite their sources, and the user
  reviews them.
- **The rough clear band misreads builds with no area,** such as minions that strike in melee (§9). The display says
  so, and the card's estimate leads.
- **The half-a-round rule can thin a round,** and the minimum wins (§7).

## 18. Choices and grants for the user

**Choices,** each with a recommendation and a real alternative:

1. **The rival.** Recommended: **every run,** once, before the verification gate, for about 150–170K output tokens
   against the pipeline's main weakness. The alternative is **on request only:** the user asks at a gate, and the
   runner starts the rival then.
2. **The beast library in the server.** **Decided: build it now** (WU-87; the user, 2026-10-18). The draft
   recommended deferring it, on the view that a beast's value is its modifier, which PoB can't model. Two facts
   overturned that: a beast reserves a percentage of Spirit, which a plan without the library can't carry, and most
   kept modifiers change stats that a plan can model (§4).
3. **The structure check.** Recommended: **in R1b, on every picked card,** so a stronger structure reaches the
   verification gate before you commit. The alternative is **in D1-build only,** cheaper but after the pick.
4. **The index's entries.** Recommended: **written once per pin by agents, committed** (about 0.6–1M tokens per pin).
   The alternative is **a search at run time only:** no upfront cost, the same search repeated in every run, and no
   `pairs.md`.

**Grants** (HG-12: any change to the tool surface or a tool's contract is the user's call), **granted by the user,
2026-10-18:**

- `compile_plan`'s record gains `clearSpeed` and movement speed on every compile, card skeletons included (D-407). No
  tool is added and no argument changes.
- The plan schema's `companion` field and the compile that reads it (D-402).

**Approved by the user, 2026-10-18:** about seven requests to poe2db by the coordinator, serial and outside the
build lanes. The monster-modifier probe used three (§4). The first digest is built from the league pages saved by
the probe of the same morning, so it needs no new request unless they prove incomplete.
