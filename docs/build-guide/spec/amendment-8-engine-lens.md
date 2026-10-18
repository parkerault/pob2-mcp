# Amendment 8: finding the build's engine

**Status: DRAFT, 2026-10-18,** for the user's review. It carries the comparison's remedies the user sent here
(`../studies/2026-10-17-varashta-comparison.md`, "the comparison", §7.2 remedies 1, 3–9, 11 and 13, and §6's
engine-lens list), the tamed-beast scope the user added on 2026-10-17 (work-log, "the engine-lens amendment's scope
gains tamed rare beasts"), the Powered by Verisium miss (`../studies/2026-10-17-varashta-run-feedback.md`, "the
feedback study", §2.2), and measured clear speed for card skeletons (the WU-81 verdict, work-log 2026-10-18). It is
written against spec v1.6 and the amendment 7 build. Paths without a directory are under
`.claude/skills/build-guide/`.

**Names.**
- A build's **engine** is what makes its damage work: the resource or condition the damage source consumes (Chilled
  Ground for Navira's Fracturing), the **supply** that makes it (a freezing nova, a tamed beast's trail, Powered by
  Verisium's infusions), and what scales it.
- A build's **structure** is its engine plus the choices that shape the whole build: the weapon's job, the number
  of minion types, a second damage source. Tuning picks the best support, passive or item for a given structure.
- A **rule changer** is a node, keystone, gem or unique that changes how a standard mechanic works (Way of the
  Stonefist turns the gloves you equip into Fists of Stone with stronger modifiers).
- The **obvious build** is what an average player would build first with the brief's skill and ascendancy.
- A **rival** is a card written with fresh context, whose only job is a different structure that clears faster.

## 1. The user's direction

- **Local maxima.** The pipeline settles on its first structure and makes no lateral moves; tuning the wrong
  structure wastes tokens (2026-10-18). An average player's first thought for a minion build is "sceptres and lots of
  Spirit", and PoB can't supply that thought.
- **Clear speed is the judge.** Players judge a build by "how quickly it can clear screens of enemies, which is a
  combination of damage, AoE, and how fast the player can move from pack to pack". Bosses are under 5% of play time
  and are a floor.
- **New content comes from the community.** poe2db is the user's go-to: exhaustive, and new league content lands
  there quickly. Agreed: a committed per-league digest that every brainstorm reads first (2026-10-18).
- **Rule changers.** Way of the Stonefist is "something that a naive researcher wouldn't think to look for". The
  user agreed to one index of rule-changing nodes, keystones, gems and uniques, searched by mechanic and never loaded
  whole. "Most uniques sacrifice the resistances, life and defences that rares provide": say it once, and list only
  explicit penalties per item. Price is popularity plus rarity, not popularity.
- **Tamed beasts** ("Yes", 2026-10-17): a table of rare monster modifiers, the beast library in the server, a library
  entry and a `pob-gaps.md` entry.

**What the run showed** (the comparison §3, §7.1):

- Navira's build beat ours about ×2.3 on a pinnacle boss and ×1.6 on map monsters. Almost none of the gap is tuning:
  where the ground comes from, how many minion types the build runs, what the weapon is for, and a second djinn.
- The research files held Muster, the +4 sceptres, Kelari and Encroaching Ground. Nothing combined them.
- Powered by Verisium was missed by the search method: every lookup asked for "Cold Infusion", never the whole
  "Infusion" family, and two researchers saw "Verisium Infusion" in a result and didn't follow it.
- Five of the round-1 deck's eight cards ran on one loop (the feedback study §1).
- Our weapon served the engine's freeze (a wand), which gave up the sceptre's Spirit and minion levels, and with
  them the army.

## 2. D-400: a league digest from poe2db

**What it is.** A committed file per league or patch section on poe2db, `knowledge/league/<slug>.md` (§12 on the
folder), that lists everything new: gems, uniques, items other than plain currency, ascendancy and passive changes.
For each entry: name, kind, tags, full text, URL, the date fetched, and whether the PoB pin knows it.

- **Head and body.** The head is one line per entry: name, kind, and the first clause of its text. The body holds the
  full text, one entry per block, for Grep. At 0.5.4 ("Runes of Aldur") the head would be about 400 lines; the
  body about 17,000 words, mostly currency, which is left out.
- **Who reads it.** Every R1a researcher reads the head whole and Greps the body by mechanic. The rival (D-408) does
  the same. Offline runs read it too: it is committed.
- **Not in the pin.** An entry the pin doesn't know can't be compiled. A card may still name it, marked as PoB can't
  measure it, as with any unmodelled line.

**The script,** `scripts/league-digest.mjs <slug>`:

- fetches the section's list pages (`https://poe2db.tw/us/<slug>_gems`, `_uniques`, `_items`) and the homepage's
  section for the league's ascendancies and passives: serial, at least 3 s apart, the server's User-Agent, no
  cookie, one retry after 60 s on 429 or 5xx, nothing fetched twice. robots.txt disallows only `/*/marked` and
  `/*/markdown_history`;
- parses the HTML exactly, not through WebFetch's summary;
- checks each name against the pinned data files (`vendor/.../Data/`) for the "in the pin" flag;
- writes the digest and prints what changed since the last one.

**Refresh.** The user runs the script when a league or patch lands; nothing runs it on a schedule. Every run
prints the digest's newest section and its fetch date at the start, so a stale digest shows.

**Tests** parse a small HTML fixture written to the pages' structure, not copied from them, with no network (D-34).

## 3. D-401: one index of rule changers

**What it is.** Entries for every rule-changing ascendancy notable, keystone, gem and unique in the pinned data, in
`knowledge/rules/`:

| File | What | Read how |
|---|---|---|
| `nodes.md` | every ascendancy notable (22 ascendancies, 209 notables) and keystone (33), one sentence each | the brief's ascendancy's section and the keystones whole (a few hundred words) |
| `uniques.md` | the rule-changing uniques among the pin's 435 | Grep only |
| `gems.md` | gems whose text changes a rule ("in place of", "count as", "instead") | Grep only |
| `pairs.md` | joins: what one entry creates against what another pays off on | Grep only |

**An entry:**

```
### Way of the Stonefist (node 39595, Martial Artist)
- Rule: the gloves you equip become Fists of Stone, and their explicit modifiers become more powerful related ones.
- Lines: "<the node's lines, verbatim>"
- Creates: glove-modifiers-boosted
- Pays off on: glove-slot
- Penalties: none
- PoB models it: no (3 of 3 lines unparsed)
- Slot and level: ascendancy notable
```

- **Creates and Pays off on** use a fixed vocabulary of mechanic families (infusion, chilled-ground, minion-count,
  minion-death, spirit, ward, the charges, the ailments, and so on), defined at the head of `nodes.md`. A family,
  never a single resource: "infusion", not "cold-infusion" (D-404).
- **Penalties:** explicit ones only ("-40% to Fire Resistance", "you can no longer regenerate Life by any other
  means"). The head of `uniques.md` says once that most uniques give up the resistances, life and defences a rare
  provides.
- **No price.** A unique's price is popularity plus rarity; it isn't evidence that players build around it.
- **PoB models it** comes from `check_model_coverage`. For a unique PoB doesn't model, the compile can measure the
  defences it gives up but not what it adds, and the entry says so.

**How it is built.** Once per pin, and again at a pin upgrade (added to `CLAUDE.md`'s upgrade steps):

1. A script lists the candidates from the pinned data: every ascendancy notable and keystone, every unique, and
   every gem whose text matches a rule-change phrase.
2. Agents write the entries in batches, from the game text and `check_model_coverage`. A unique or gem with no rule
   change gets no entry.
3. A script checks every entry's format and vocabulary, and joins Creates against Pays off on into `pairs.md`.
4. An independent verifier checks a sample of entries against the game text.

The one-time cost is about 0.6–1M tokens per pin, mostly step 2.

**Who reads it.** R1a researchers (the items focus Greps `uniques.md`, the tree focus reads `nodes.md`, every focus
Greps `pairs.md` for its engine's families), D1-build before designing `b` and `n`, and the rival.

## 4. D-402: rare monster modifiers and the tamed beast

A tamed rare beast keeps up to four of its monster modifiers. Navira's guide tames one with Frozen Ground Trail, so
the beast makes the Chilled Ground the build consumes. PoB has no table of rare monster modifiers and no way to give
a companion one, and our server doesn't read or set PoB's beast library at all.

- **A table of rare monster modifiers,** `knowledge/monster-mods.md`, from poe2db: name, in-game text, what it does,
  and whether a tamed beast can keep it. Its work unit starts with a probe of at most three requests, to find the
  page that lists them; if none does, it stops and reports. Researchers Grep it as they Grep the index, and its
  supplies join `pairs.md` (a beast's trail creates chilled-ground).
- **A library entry:** "a tamed rare beast supplies a condition the engine needs", with Navira's build as its
  example.
- **PG-55** in `pob-gaps.md`: PoB has no rare monster modifiers.
- **The beast library in the server** (§15, choice 2). A plan names the companion's species
  (`companion: {species}`), and the compile sets PoB's beast library from it, so the beast's damage, defences and
  Spirit cost are measured. This bumps the plan schema and changes `compile_plan` (HG-12, the user's call on the tool
  surface; the user's "Yes" to the scope would be that call). The spectre library could share the path; it isn't in
  this amendment.

## 5. D-403: the obvious build is always in the deck

- **Standard kits.** The pattern library gains a section, "Standard kits", one short entry per archetype: what an
  average player knows to use, and the archetype's big levers. For minions: a sceptre, lots of Spirit, minion levels
  on the helmet, amulet and focus, more minion types; the levers are minion levels, Spirit, minion types and minion
  damage supports. Each kit line cites a study, a lookup or the user. The user reviews the kits before they bind,
  since they are meant to be what an average player knows (§13, WU-90).
- **The ascendancy's own design is a prior.** The tree focus reads its section of `nodes.md` and says what the
  ascendancy is built to do (Varashta's nodes are djinns, so two djinns are the intended play).
- **The obvious card.** In round 1, the mechanics researcher's first card (`r1-a-1`) is the obvious build: the
  brief's skill on its ascendancy with the archetype's standard kit and the ascendancy's intended play. Its pitch
  carries `- Obvious build: <the kit it follows>`. With no skill in the brief, it is the obvious build for the
  playstyle's archetype.
- **Every other card answers it.** A card's "How it clears" says how it clears faster than the obvious build, or why
  it's worth picking anyway.
- **Dealt whenever it passes** the identity and sniff checks (R1a-assemble, steps 2 and 3). It counts toward the
  6–9 cards.

## 6. D-404: search a supply by its family, and follow strange words

When a card's chain consumes a resource or a condition, the researcher's supply search covers:

- **the whole family and its substitutes:** `lookup_game_data {mode: "mechanic", query: "Infusion"}`, not "Cold
  Infusion"; the family's name as the index spells it in `pairs.md`; and the digest's body;
- **every source kind:** gems, uniques, passives, ascendancy nodes, and the monster-modifier table;
- **unfamiliar terms:** a term in a result that the researcher can't place ("Verisium Infusion") gets one lookup
  before the search ends.

The research file gains a `## Supply search` section per consumed resource: each supplier found, the lookup or file
that found it, and whether a card uses it, and if not, why. The deck's "Found, not used" list (D-392) draws on it.

## 7. D-405: no more than half the deck on one engine

R1a-assemble's step 5 (deal 6–9 cards) gains a rule: no more than half the dealt cards share one engine, that is,
the same consumed resource and the same supply. When more pass, deal the ones that differ and put the rest under
"Not dealt" as `the deck already holds <n> cards on this engine`. The deck's "How they differ" header names each
engine and its card count.

## 8. D-406: the structure check, on paper, before the skeleton

R1b gains a first step for each card the user picked to verify, before any compile. It costs a few paragraphs of
arithmetic, and no compile:

1. **The levers.** For the archetype's big levers (D-403), what the card pulls and what it leaves. "100 Spirit on a
   minion build" is one line.
2. **Flip the assumptions.** The card's two or three load-bearing assumptions, each reversed in a paragraph: "the
   ground needs a freeze" leads to the infusion search; "the weapon is a wand" leads to a sceptre and the army; "one
   djinn" leads to Kelari.
3. **Counts.** What grows with a count (Muster with minion types), and what pays for a bigger count (a sceptre's
   Spirit). The arithmetic is rough on purpose: Muster at eight types is about 7% × 8.
4. **Premium slots.** What each premium slot serves. A slot that props up the engine rather than the damage is a
   lead: search for a supply that frees it (D-404).

It writes the card's `### Structure check` (a new heading in the verification half). When a flip beats the card on
paper, its last line reads `- A stronger structure? <the flip, in a sentence, and the rough multiplier>`. The
verification gate's display shows that line under the card. The user can make a new card from it there (D-391).

D1-build repeats step 1 with the compiled figures before designing `b` and `n`, and states any lever it leaves
unpulled in the plan's notes.

## 9. D-407: clear speed is measured at every compile, and leads

- **Measured on skeletons.** The record's rough `clearSpeed` (D-353) is measured at every compile with a stage that
  reaches the endgame bar, card skeletons included, not only the variant stages (`compiler.ts:1054` today). The
  verification gate shows the measured band where WU-81's fix round now shows the card's estimate.
- **Pace beside it.** The record shows the player's movement speed beside the band. Time to first damage on a new
  pack isn't in PoB; the designer estimates it in the card's "How it clears", marked as an estimate.
- **The order.** Cards, displays and the design gate lead with clear speed, then the boss floor (the Arbiter check).
  It stays rough: the user's Q2 answer still holds for how it's measured; what changed is how much it counts.
- **Overriding PoB's ranking.** A designer may choose a support, passive or item that PoB ranks lower for what PoB
  can't measure (area, supply rate, pace), with a note in the plan: `override: <PoB's first choice> → <ours>:
  <why>`. Encroaching Ground in our Varashta run is the example: found, never used, because the ranking was by DPS.

HG-12 covers the record's added fields on skeleton compiles; no tool or argument is added.

## 10. D-408: a rival with fresh context

After R1b has verified the picked cards, and before the verification gate, one more agent runs: stage `RV`, a
`build-guide-researcher` with fresh context.

- **It reads** the brief's identity, the verified cards' figures (from R1b's verdict files: DPS, clear speed, EHP),
  the pattern library, the digest and the index. It never reads the run's research files, the cards' chains or the
  dossier, so it doesn't share their blind spots.
- **Its job:** one card, `r<k>-x-1`, with a structure different from every verified card's, that clears faster on
  paper, with the arithmetic. Or the one line `no faster structure found`, with what it tried.
- **Its card** goes through R1b like any picked card. R1b first runs R1a-assemble's identity and sniff checks on it
  and fails it as `not-dealt` when they fail. The verification gate shows it beside the others, marked as the rival.
- **The cost:** one researcher and one R1b per run. If the rival can't find a faster structure, the pick is probably
  near the top before the expensive design steps start. If it can, the tuning would have been wasted.

## 11. D-409: the library's new entries

Within the 10,000-word cap (D-381; the library is at 5,999 words):

- **Brainstorm questions 11–14:** what does the obvious build do, and how is this card faster? What grows with a
  count, and what pays for a bigger count? What does each premium slot serve? Which rule changer touches this
  engine (`pairs.md`)?
- **"Standard kits"** (D-403), about 1,200 words.
- **New shapes,** each with its search step, how PoB follows it and its cautions:
  - **a minion army as a multiplier** (Muster and At your Command with minion types, paid for by Spirit);
  - **bank the resource** (a stored supply, such as infusions held between packs, clears faster than one made on
    the spot);
  - **a tamed rare beast supplies a condition** (D-402);
  - **a rule changer** (Way of the Stonefist; how to use the index).

## 12. Where the knowledge files live

`knowledge/` is a new folder under the skill: `league/`, `rules/` and `monster-mods.md`. The skill-split design
(`../../design/2026-10-18-skill-split.md`) proposes a game-knowledge skill as the base for the other pieces; if the
user takes its first choice, the folder moves there whole with the pattern library, `lookups.md`,
`source-markers.md` and `pob-gaps.md` (§15, choice 3). The agents' Read and Grep rules gain the folder.

## 13. Work units

| Unit | Slice | What | Depends on | Risk |
|---|---|---|---|---|
| WU-84 | 03 | The league digest (D-400): the script, its fixture tests, the first digest for the current section (poe2db only, under the script's rules) | — | low |
| WU-85 | 03 | The rule-changer index (D-401): the candidate script, the vocabulary, the format check and the join, then the entries (agents in batches), then a verifier's sample | — | medium: the largest content pass |
| WU-86 | 03 | Rare monster modifiers (D-402): the probe, the table, PG-55 | — | medium: the source may not exist |
| WU-87 | 02 | The beast library (D-402), if §15 choice 2 keeps it: plan schema, the compile, measures, tests | — | medium: a schema bump |
| WU-88 | 02 | Clear speed on skeletons and the movement speed beside it (D-407): `compiler.ts`, `record.ts`, tests | — | low |
| WU-89 | 03 | The scripts: the obvious card's pitch field, the `x` card id, `RV` in the run log, the variety rule and the structure-check line in the deck and displays, the `override:` note in the checker | — | medium: every display again |
| WU-90 | 03 | The library (D-403, D-409): standard kits, questions 11–14, four shapes; the user reviews the kits | WU-85 (the rule-changer shape cites the index) | low |
| WU-91 | 03 | The skill text: R1a (the digest, the index, D-404's search, the obvious card), R1a-assemble (D-403, D-405), R1b (D-406, the rival's checks), D1-build (D-406's levers, D-407's override), a new `stages/RV.md`, `SKILL.md`'s rival step, the agents' Read rules, static tests | WU-84…WU-86, WU-89, WU-90 | medium: many files |

WU-84, WU-85, WU-86, WU-88 and WU-89 can run in parallel. WU-87 can too, if kept. WU-91 is last.

**Acceptance criteria** (one per unit; the build's handoff gives the details):

- **AC-W70 (WU-84).** Script unit: the parser on the fixture yields every entry with its kind, tags, text and URL;
  currency is left out; the in-pin flag is right for one known and one unknown name. No test touches the network.
- **AC-W71 (WU-85).** Script unit: every entry passes the format and vocabulary check; the join pairs a fixture's
  "creates infusion" with its "pays off on infusion"; Way of the Stonefist's entry exists with "PoB models it: no".
  Static: `uniques.md`'s head carries the one-line penalty rule.
- **AC-W72 (WU-86).** The table exists with its source URLs, or the unit's report says why it can't.
- **AC-P72 (WU-87).** Engine: a plan naming a companion species compiles, and the record holds the companion's DPS
  and Spirit cost.
- **AC-P71 (WU-88).** Engine: a skeleton's compile record holds `clearSpeed` and the movement speed.
- **AC-W73 (WU-89).** Script unit: the deck check refuses a sixth card on one engine in a deck of nine dealt from
  fixtures; the display shows the obvious card's field and a structure-check line; the run log accepts stage `RV`
  and the card id `r1-x-1`.
- **AC-W74 (WU-90).** Static: the library holds "Standard kits" and the four shapes and stays under 10,000 words.
- **AC-W75 (WU-91).** Static: R1a carries D-404's three rules and the `## Supply search` section; R1a-assemble
  carries D-405; R1b's verification half carries `### Structure check`; `stages/RV.md` lists its reads and never the
  run's research files; `SKILL.md` runs `RV` before the verification gate.

**The first live test** is the next run, which should show: the obvious card in the deck, a supply search that
finds a family's substitutes, and a rival that either beats the pick or fails to.

## 14. Risks

- **The index is one agent pass of judgment.** A wrong "creates" tag hides a pair. The verifier's sample catches
  some; a researcher still confirms every link with a lookup before a card is dealt.
- **poe2db changes its pages,** and the script's parser breaks. It fails loudly; the user re-runs it after a fix.
  Committing the digest means its text is the game's own, with poe2db's URLs, as the reference data already does.
- **More reading per researcher.** The digest's head and the brief's ascendancy section of the index add about
  5,000 tokens to each R1a researcher; the Grep reads are small.
- **The rival adds a skeleton compile** to every run (one researcher and one R1b).
- **Standard kits encode common wisdom,** which can be stale after a patch. They cite their sources, and the user
  reviews them.

## 15. Choices for the user

Each has a recommendation and a real alternative.

1. **The rival.** Recommended: **every run**, before the verification gate: one researcher and one R1b against the
   pipeline's main weakness. The alternative is **on request only**, at the brainstorm or verification gate.
2. **The beast library in the server.** Recommended: **defer it.** The table, the library entry and the gap entry
   carry the miss; in Navira's build the beast's value is its modifier, which PoB can't model anyway. The
   alternative is **build it now** (WU-87), as the scope of 2026-10-17 listed.
3. **Where `knowledge/` lives.** Recommended: **under `build-guide` now,** moved whole if the skill split's first
   extraction happens. The alternative is **the extraction first**, so the files land once in a game-knowledge skill.
4. **The structure check.** Recommended: **in R1b, on every picked card,** so a stronger structure reaches the
   verification gate before the user commits. The alternative is **in D1-build only,** cheaper but after the pick.
5. **The index's entries.** Recommended: **written once per pin by agents, committed.** The alternative is a
   **runtime search only** (no upfront cost, the same search repeated in every run, and no `pairs.md`).
