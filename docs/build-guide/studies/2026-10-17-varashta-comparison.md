# Navira's Fracturing: our baseline build against Navira's guide (2026-10-17)

**Ours** is the Varashta baseline run (`disciple-of-varashta-navira-s-fracturing/2026-10-17-1`, online, accepted at
the final gate): its guide, audit, plan, compile record and PoB file, in
`/home/parker/projects/pob2-mcp-runs/m16-varashta/`. **Navira's** is the user's name for MisoxShiru's Mobalytics guide
"Navira's Fracturing Varashta League Starter" for patch 0.5.5, captured on 2026-10-16 (`reference/navira-guide.txt`),
and its PoB (`reference/navira-pob.xml`). The user named both. Neither file is in this repo.

Figures are PoB's unless marked. Both PoB files were measured read-only in the same engine: the `m17` worktree's build
at `857658c` (PoB2 v0.23.1, with the D-382 compile fix and amendment 6's minion skills), started from a temp folder
with trade and poe.ninja off.

## 1. Summary

1. **Both builds found the same core.** Minion deaths charge Cast on Minion Death, and that feeds Ice Nova's Chilled
   Ground for Navira's Fracturing to shatter. In ours, that core came from the user's round-2 note at the brainstorm
   gate ("investigate whether Unholy Might + cast on minion death could create an engine for creating frozen ground",
   `dossier.md:3`), not from the pipeline's own research.
2. **What the deaths make differs.** In Navira's, Cast on Minion Death casts Powered by Verisium, which spends Runic
   Ward for Verisium Infusions; the self-cast Ice Nova consumes them for Chilled Ground. In ours, Cast on Minion Death
   casts Ice Nova itself, and its freezes lay the ground through Frost Nexus. Our run never looked Verisium up
   (`2026-10-17-varashta-run-feedback.md` §2.2).
3. **Navira's is a minion army; ours is two fodder types.** Navira's late endgame runs about eight minion types on a
   sceptre's Spirit (334 in all; ours 100). Muster and At your Command both scale with the number of types. Ours runs
   Skeletal Warriors and a Skeletal Arsonist under Vis Mortis, which halves minion life so they die sooner.
4. **Navira's takes a second djinn for bosses.** Its first ascendancy is Kelari (Barya of Kelari and Kelari's
   Deception), the guide's single-target answer from Act 2 on. Ours has no second djinn. Our research found Barya of
   Kelari, but no picked card used it.
5. **Measured like for like,** Navira's Fracturing does 119,260 on Navira's late endgame against 51,349 on our
   non-budget variant (a pinnacle boss, no At your Command stand-in): about ×2.3. Against map monsters, with our 25%
   stand-in on both, it is 151,195 against 95,437: about ×1.6. Muster, which scales with minion types, is most of the
   gap: without it Navira's does 73,246 against the boss. Navira's effective hit pool is 24,192 (Chaos Inoculation,
   8,681 energy shield); ours is 13,954 (2,044 life, 4,469 energy shield).
6. **The tamed beast is in Navira's guide text only.** The guide offers a tamed beast with Frozen Ground Trail as an
   endgame way to make the build one button. Its PoB has no beast. Our run has none either.
7. **Ours is better in places.** Every stage is a complete loadout, measured at its own level, with resistances capped
   from entering maps on. It needs no respec in Act 2, and the guide states what PoB can't show. Navira's PoB has two
   incomplete endgame variants, and its campaign variants are gear guidelines with uncapped resistances.
8. **No legacy gem in either final build.** Ours carried Commandment until the user removed it at the verification
   gate (§2.1 of the feedback study).

## 2. The two builds in player terms

| | Navira's | Ours |
|---|---|---|
| Ground | Ice Nova, self-cast with Encroaching Ground and Magnified Area II, consumes Verisium Infusions for Chilled Ground; Frost Nexus on Navira adds ground when she freezes | Ice Nova, triggered by Cast on Minion Death with Frost Nexus, freezes for 8 s patches; Frost Bomb's Cold Infusion seeds a patch at bosses |
| What dies | Wolf Pack's wolves with Romira's Requital (they take part of your hits), Minion Instability, Infernal Legion I and Feeding Frenzy; skeletons with Last Gasp | Two Skeletal Warriors with Infernal Legion II, Minion Instability, Essence Harvest and Sacrificial Lamb II, at half life under Vis Mortis; the Arsonist detonates them |
| Death to ground | Cast on Minion Death with Powered by Verisium, Energy Retention and Boundless Energy II | Cast on Minion Death with Ice Nova |
| Navira's supports (late) | Bidding II, Muster, Frost Nexus, Encroaching Ground, Cold Penetration | Bidding II, Cold Attunement, Hulking Minions, Minion Mastery, Elemental Focus |
| Single target | Kelari's Deception and Kelari's Brutality, from Act 2 | Navira's Fracturing on Frost Bomb's patch |
| Minion types (late) | Navira, Kelari, Wolf Pack, Skeletal Storm Mage, Frost Mage, Sniper, Cleric, Arsonist | Navira, Skeletal Warrior, Skeletal Arsonist |
| Weapon | a sceptre: Maelstrom Knell (+4 minion levels, 184 Spirit, grants Purity of Ice) and a +2 focus | a wand (Rime Twig) and a +2 focus |
| Minion levels from gear | +12 (sceptre 4, focus 2, helmet 2, fractured amulet 4) | +10 non-budget, +6 budget |
| Spirit | 334, 20 unreserved | 100, 33 unreserved |
| Defence | Chaos Inoculation, energy shield, Runic Ward 62 on the gloves (Powered by Verisium's cost) | life and energy shield, Vis Mortis (no resistances), Sacred Rituals |
| Ascendancy | Kelari and Kelari's Deception (Act 2), Navira and her Fracturing (Act 3), then Energy Shield, The Fourth Teaching, Baryanic Leylines, Area of Effect | Navira and her Fracturing (Act 2), then Energy Shield twice, Area of Effect, The Fourth Teaching, Sacred Rituals, Cast Speed |
| Tree, late | minion notables (At your Command, Growing Swarm, Lord of Horrors, Gigantic Following), the three infusion limits (Frozen, Infernal, Shocking Limit), Chaos Inoculation | minion and freeze notables (At your Command, Deadly Swarm, Shattering, Restless Dead), energy shield (Heavy Buffer, Melding, Pure Energy), Dynamism |
| Campaign | chaos spells before ascending (Entangle, Contagion, Essence Drain, Bonestorm), then a respec in Act 2 for 5,000–7,000 gold | Ice Nova and a Skeletal Warrior from Act 1; no respec |

Sources: `navira-pob.xml` skill sets 5, 6 and 8 and item set 8; `navira-guide.txt:30-60`; our `guide.md` "Leveling"
and endgame sections; our PoB's skill sets 5 to 9.

## 3. Measured side by side

| | Ours, budget (L90) | Ours, non-budget (L96) | Navira's, late endgame (L97) |
|---|---|---|---|
| Effective hit pool | 12,203 | 13,954 | 24,192 |
| Life / energy shield | 1,838 / 3,911 | 2,044 / 4,469 | 1 / 8,681 |
| Resistances (fire, cold, lightning, chaos) | 75/75/75/75 | 75/75/75/75 | 75/75/75, chaos immune |
| Max physical hit taken | 5,974 | 6,770 | 9,746 |
| Spirit (unreserved) | 100 (33) | 100 (33) | 334 (20) |

Navira's Fracturing (`MinionTotalDPS`, the field the compile record reads):

| Configuration | Ours, non-budget | Navira's, late endgame |
|---|---|---|
| As each file sets it | 95,437 (map monster, our 25% stand-in) | 119,260 (pinnacle boss, no stand-in) |
| Pinnacle boss, no stand-in | 51,349 | 119,260 |
| Map monster, no stand-in | 90,250 | 142,195 |
| Map monster, our 25% stand-in on both | 95,437 | 151,195 |
| Pinnacle boss, Navira's without Muster | | 73,246 |

Our figures equal the compile record's (`compile-record.json` stages `b` and `n`), so the engine reproduces the run.
Navira's late endgame measures the same at levels 96 and 97. The last two Navira rows come from edited temp copies of
its PoB (the rebuilt group saved in, the config set in the file), loaded fresh: on the loaded build, those edits timed
out in the engine (§6, the server). The unedited control copy measures 119,260, as above.

**What the rows say:**

- **Navira's is ahead on every like-for-like row:** ×2.3 against a pinnacle boss, ×1.6 against map monsters, both
  with the same At your Command handling.
- **Muster is most of the gap.** Without it, Navira's drops to 73,246 against a pinnacle boss, ×1.4 ours. It is worth
  ×1.63 there, which at 7% a type, added up, means PoB counts about nine reviving types.
- **Ours loses far more to a pinnacle boss:** ×0.57 (90,250 to 51,349) against Navira's ×0.84 (142,195 to 119,260).
  Navira's group carries Cold Penetration; ours has none. That the boss's resistances explain the difference is my
  judgment, not measured. Every headline figure in our run is against map monsters, and its Arbiter check covers the
  hits the player takes, not the damage a boss takes.

**How to read them:**

- **Navira's late Navira group had to be rebuilt.** The guide's PoB puts Navira's supports into the tree-granted
  group. PoB v0.23.1 rebuilds a granted group from its grant on every calculation, which drops its supports
  (`vendor/.../Modules/CalcSetup.lua:1503-1534`: a group whose gem level differs from the grant isn't matched, and a
  matched group's gem list is wiped back to the granted gem). So our engine silently loses them, as it does Kelari's
  and the sceptre's Purity of Ice supports. I measured a socketed level-20 Navira with the guide's five supports,
  which is how our pipeline models her (PG-51). The game's summon level is unsourced for both.
- **PoB can't model the engine in either build.** Both figures assume enemies standing on Chilled Ground, and PoB
  doesn't check for ground. It models no Meta-skill Energy, so neither death engine is in the numbers, and nothing
  about Verisium Infusions or their Runic Ward cost.
- **At your Command:** PoB applies none of it to Navira (the runner's gap list, feedback study §5.1, item 8). Ours
  adds a 25% stand-in for about 2.5 persistent types. Navira's runs about eight types, worth up to 80% if they all
  count, so the like-for-like rows understate Navira's.
- **Muster** reads PoB's count of reviving minion types, which the run found includes Navira and Cast on Minion Death
  (the same item). Navira's many types make it worth more there than it would be in ours.
- **The enemies differ.** Ours is set to map monsters; Navira's to a pinnacle boss.
- **The other variants aren't comparable.** Navira's Early and Mid Endgame variants are incomplete in the export (12
  and 23 tree points, almost no gear). Its Act 3 and Act 4 variants sit at the file's level 97 with uncapped
  resistances (fire −45%) and over-reserved Spirit. They are gear guidelines, not loadouts. Its Uber variant's gear
  leaves resistances at 17–19%.

## 4. Where the builds diverge, and why ours went its way

| Divergence | Where our pipeline missed it or chose otherwise |
|---|---|
| **Powered by Verisium as the infusion supply.** The deaths refill Ice Nova's infusion, so the nova lays ground without a freeze, and the three infusion-limit notables let the player hold more. | R1a, the research stage. Every infusion lookup was "Cold Infusion" or "Infusion Remnant", and two researchers saw "Verisium Infusion Remnant" without following it (feedback study §2.2). A supply-search miss. |
| **A minion army on a sceptre.** About eight types make Muster and At your Command large, and the sceptre's Spirit pays for them. | R1a found both pieces: Muster's "7% more damage for each different type of Reviving Minion" (`research/p1-r1a-2.md:68`) and +4 sceptres (`research/p1-r1a-2.md:48`). No card combined them. Card r1-c-2 counted the djinn as Muster's types, and card r2-c-3 counted the skeletons as a second type for At your Command (node 35560), but no card grew the number of types, and the design took a wand for Ice Nova's freeze buildup and spell damage (`guide.md`, the budget table). Nothing asks "what scales per type, and what pays for more types". |
| **Kelari for single target.** | R1a listed Barya of Kelari and Kelari's Deception (`research/p1-r1a-3.md:10-16`), and card r1-c-2 took Kelari for headcount. No card made it the boss answer: a card's only boss line is a risk ("Resistant bosses", as in `cards/r1-b-1.md`), not a second damage source. |
| **The tamed beast with Frozen Ground Trail.** | Out of reach: the server has no beast or rare-monster-modifier data. Already in the engine-lens amendment's scope. |
| **Encroaching Ground** on Navira and Ice Nova (surfaces grow, up to 100% more area). | R1a found it (`research/p1-r1a-3.md:73`), but no plan used it. The design chose Navira's supports by measured DPS (the FAQ's Elemental Focus figure, `guide.md` "FAQ"), and PoB gives ground area no value, so a ground-area support loses to any damage support. |
| **Defence.** Chaos Inoculation on energy shield (24,192 EHP) against our life and energy shield hybrid (13,954). | A choice, not a miss. Vis Mortis is our engine's body armour, and it has no resistances, which pulled the design toward capped resistances on every other slot. Our build survives the Arbiter's hits on both endgame variants. |
| **Commandment**, a legacy gem. | Ours used it until the user removed it (feedback study §2.1). Navira's uses none of PoB's eight legacy gems. |
| **Campaign start.** Navira's levels on chaos spells and respecs in Act 2; ours levels on Ice Nova from Act 1. | A choice. Ours avoids a 5,000–7,000-gold respec. Navira's is the guide author's tested route; ours is unproven in game. |
| **Ascendancy order.** Kelari first (Act 2), Navira second (Act 3); ours takes Navira first. | Ours has no second djinn, so Navira comes first. Navira's guide says Kelari carries the build from Act 2 on. |

**Where ours is arguably better:**

- **Complete loadouts.** Every stage has its own tree, gear, gems and config, measured at its own level, with capped
  resistances from entering maps on. A player can follow the PoB file without guessing.
- **No respec**, and Vis Mortis costs about 1 exalted (the guide's price, `guide.md` "At a glance").
- **The limits are stated:** what PoB can't show, the hand-calculated death engine, the thin one-nova-per-death
  margin, and the At your Command stand-in.

## 5. The guides as guides

| | Navira's | Ours |
|---|---|---|
| Length | about 1,100 words of captured page text, plus the PoB; the page's gear, gem and tree panels per variant flatten in the capture | about 3,100 words, plus a 2,700-word audit layer |
| Structure | overview, two questions (when to tame the beast; is it expensive), strengths and weaknesses, eight variants, gear priorities, an Act 1 gem walkthrough, quest rewards | at a glance, the PoB file, survival by stage, gem and ascendancy timing, priorities, levelling by stage, campaign rewards, three endgame variants, how to play, what PoB can't show, FAQ |
| Levelling | which uncut gem to cut where in Act 1, and the respec at Act 2 | each stage's setup, tree, attributes, upgrade order and life target, and when to swap |
| Gear | priorities (minion levels on sceptre, helmet and amulet; life; cold resistance for Count Geonor; runes for missing resistances), a vendor regex | per-stage buy orders, and must-have tables for the endgame variants |
| Numbers | none in the text; "super tanky" and "dirt cheap" are the author's claims | DPS, effective hit pool, resistances and the Arbiter's verdict per stage; prices unknown (rate-limited) |

**What a player gets.** Navira's: a short, proven guide whose substance lives in the PoB, with the author's
experience behind its claims: the author reports reaching tier-15 maps in hardcore solo self-found within a day of
reaching the endgame (`navira-guide.txt:56`). Ours: a longer, measured and explained guide that is unproven in game.

**Ours lacks:**

- where to find each gem in the campaign;
- a vendor regex;
- the "one button" pitch that tells a player why to pick the build.

**Navira's lacks:**

- per-stage defence numbers: its campaign gear sets don't cap resistances;
- complete Early and Mid Endgame variants in the PoB.

## 6. Lessons, by where they belong

**The feedback amendment** (gates as interviews; `2026-10-17-varashta-run-feedback.md`):

- **Our build's engine came from the user's "this one, but…" note at the brainstorm gate.** An interview gate makes
  that the normal path. A question like "can X make an engine?" should be researched and answered at the gate, not
  only carried as a note into the next round.
- **A card's pitch should say what Navira's guide leads with:** one-button clear (with the beast), a named boss
  answer (Kelari), cheap to build, no respec. Those are the comparisons a player makes.

**The engine-lens amendment** (how designers find a build's engine):

- **The supply search covers the resource's class and its substitutes.** Search "Infusion", not "Cold Infusion",
  and follow unfamiliar terms (Powered by Verisium; already in scope).
- **Ask what scales per type, and what pays for more types.** At your Command and Muster grow with minion types, and
  Spirit from a sceptre funds them. A library entry such as "a minion army as a multiplier" would have led to
  Navira's shape.
- **Ask for a single-target answer on every card.** A second damage source, such as a second djinn, is a boss
  answer the ground loop doesn't give. It is a floor check: players judge a build by clear speed, not bosses (§7.1).
- **A tamed rare beast as a ground source** (already in scope).
- **Value what PoB can't measure.** A design that ranks supports only by measured DPS never takes ground area
  (Encroaching Ground) or supply rate. The designer needs a stated reason to override the ranking for the engine's
  own supply.

**The server:**

- **Loading a PoB whose tree-granted groups hold supports silently drops them** (§3). Navira's export has them,
  probably from a newer PoB. The load summary says nothing. A `pob-gaps.md` entry, plus a load warning naming the
  dropped gems, would stop a reader from measuring an unsupported djinn. This matters for any start-from-a-PoB path.
- **A heavy minion build stalls the engine session.** On Navira's PoB (about eight minion types), the session's
  snapshot after a change (`export_build_xml`) timed out: a loadout switch at the default 30-second
  `POB_TIMEOUT_MS`, and a custom-modifier `set_config` and a `toggle_gem` even at 300 seconds. Loading the file and
  read-only stats were fine. Worth a probe: a guide author's real build is exactly this size.
- **The legacy flag** (feedback study §2.1).

**The skill-split idea:**

- **This comparison is the start-from-a-PoB path done by hand:** import an author's PoB, rebuild what PoB drops,
  measure it, and compare. Navira's export shows the work such a path would do for a guide author: its incomplete
  Early and Mid Endgame variants and its uncapped campaign gear are what our compiler's stage loadouts supply.
- **A review skill** run on Navira's PoB would have flagged the uncapped campaign resistances, the over-reserved
  Spirit and the 12 gem groups over PoB's limit of 9 (PoB's own warning on load).

## 7. General lessons

Added on 2026-10-18, from a discussion with the user. §6 sorts the specific lessons by where they go; this section
says what carries beyond this build. In short, almost none of the gap comes from tuning. Our pipeline measured and
tuned the build it chose well. Navira's guide chose a better build.

### 7.1 What went wrong

- **Tuning can't find a better build structure.** The compile-and-measure loop picks the best support, passive or
  item for the build it is given. The ×2.3 boss gap comes from structural choices: where the Chilled Ground comes
  from, how many minion types the build runs, what the weapon is for, and a second djinn. Muster shows why no ranking
  gets there. At two or three types it is a modest support, and a slot-by-slot ranking is right to drop it; at about
  eight it is worth ×1.63 (§3). Each added type costs Spirit and helps little alone, so no run of single improvements
  reaches the army.
- **Tuning the wrong structure wastes tokens.** Compiles and tuning are the expensive steps. They belong after a
  structure has beaten its alternatives on paper, where rough multiplier arithmetic is enough: Muster at eight types
  is 7% × 8, about ×1.56.
- **The pipeline settles on a local maximum without lateral moves** (the user's diagnosis). An average player's first
  thought for a minion build is "sceptres and lots of Spirit". PoB can't supply that thought, and no step in our
  pipeline does.
- **Research found the pieces, and nothing combined them.** Muster, the +4 sceptres, Kelari and Encroaching Ground are
  all in the research files (§4). Round-1 cards put Muster on Navira (`cards/r1-b-1.md`, `r1-b-3.md`, `r1-c-2.md`),
  and four of round 2's nine cards used a sceptre: for its minion levels (`r2-a-1.md`, `r2-b-1.md`) or its free
  Skeletal Warriors (`r2-b-2.md`, `r2-b-3.md`). None spent the sceptre's Spirit on more minion types. The one true
  miss, Powered by Verisium, was a search-method miss (feedback study §2.2).
- **Players judge a build by clear speed,** which is damage × area × pace between packs. Bosses are under 5% of play
  time, and more damage solves them, so a boss figure is a floor check, not the judge (the user). Our headline target,
  map monsters, was the right one, but area and pace were never measured:
  - **Area.** Navira's spends supports on it (Encroaching Ground, and Magnified Area II on Ice Nova). Ours spent every
    slot on damage.
  - **Pace,** as we read the two builds (not measured or tested). Navira's banks Verisium Infusions between packs (the
    three infusion-limit passives), so the nova can lay ground as the player arrives. Ours makes ground only as
    skeletons die inside the pack: "I stay close so the novas reach the pack" (our `guide.md`, "How to play it"). A
    stored supply clears faster than one made on the spot.
  - PoB reports a skill's area and the player's movement speed, so a rough clear figure is possible. The time to first
    damage on a new pack isn't in PoB, so the designer estimates it.
- **A weak link in the engine taxes the whole build.** Our ground needs the player's nova to freeze, so the weapon went
  to freeze buildup and spell damage (a wand). That gave up the sceptre's 184 Spirit and +4 minion levels, and with
  them the army. Vis Mortis, the engine's body armour, has no resistances, so every other slot carries them. Powered by
  Verisium makes ground from deaths without a freeze, so Navira's weapon can serve Navira.
- **New content is a recurring problem for every PoE2 tool.** The newest mechanics are the least explored. The user:
  it is solved only by the player community's crowd-sourced services (poe2wiki, PoB and poe2db are maintained that
  way), or by ingesting YouTube videos. Our game data is PoB's, behind the pin: 0.5.4 data against Navira's 0.5.5
  guide, whose PoB, probably from a newer release, keeps supports in tree-granted groups that ours drops (§3).

### 7.2 What would help

**Before any card is drawn:**

1. **Start from the obvious build.** Write down, once per archetype, what an average player knows. For minions that is
   a sceptre, lots of Spirit, minion levels on the helmet, amulet and focus, and more minion types. The ascendancy's
   own design is a prior too: Varashta's nodes are djinns, so running two is the intended play. The first card of
   every brainstorm round is that obvious build. Every other card has to clear faster, or say why it's worth it anyway.
2. **Seed with an expert build when the user has one.** A reference build the user picks enters the brainstorm as a
   seed card. Starting from an expert's maximum is the cheapest way out of our own, and it is the "customise a
   community build" use case (feedback study §3).
3. **Know what's new from the community.** A "what's new" step reads the crowd-sourced services or a video transcript
   (the user's local YouTube library already makes one). Which services, and how within their terms, is the user's
   call (compare poe.ninja's closed builds API, D-335).
   - **The user's choice (2026-10-18): poe2db,** as a committed per-league digest that every brainstorm reads first.
     It is built from the league's list pages, which carry every entry's full text, one request each. Example:
     `https://poe2db.tw/us/Runes_of_Aldur_gems` lists all 57 new gems, Powered by Verisium among them.
   - **poe2wiki** refuses agents behind Anubis, a bot shield, for both its pages and its API.

**While designing, before any compile:**

4. **Check the archetype's big levers.** For minions: minion levels, Spirit, minion types and minion damage supports.
   Flag any lever the design leaves unpulled. "100 Spirit on a minion build" is one line of arithmetic.
5. **Flip the build's assumptions.** List its load-bearing assumptions and sketch the build with each one reversed,
   in a paragraph, not a compile. Three of ours lead straight to Navira's build:
   - "the ground needs a freeze" leads to the infusion search, then Verisium;
   - "the weapon is a wand" leads to a sceptre, then Spirit, then the army;
   - "one djinn" leads to Kelari.
6. **Ask what grows with a count, and what pays for a bigger count.** Muster and At your Command grow with minion
   types, the infusion-limit passives with infusions held; Spirit from a sceptre pays for more types.
7. **Ask what each premium slot serves.** If it props up the engine rather than the damage, search for a supply that
   frees it.
8. **Search a resource by its whole family, and follow unfamiliar terms:** "Infusion", not "Cold Infusion" (already
   in the engine-lens amendment's scope).
9. **Score clear speed, with bosses as a floor.** Damage from PoB, area and movement speed from PoB, time to first
   damage estimated. A designer may override PoB's damage ranking for area, supply or pace, with a stated reason.

**At the gates:**

10. **Show a found-but-unused list:** the strongest research findings no card uses, each with its reason.
11. **Bring in a rival with fresh context.** Our designers share one set of research and briefs, so they share blind
    spots. A fresh agent gets only the ascendancy, the skill and the pick's figures, with one job: a structurally
    different build that clears faster. If it fails, the pick is probably near the top; if it succeeds, tuning would
    have been wasted. It costs one agent.

**After a run:**

12. **Compare against a build the user picks, and keep what it teaches.** This comparison found more than all the run's
    own checks. Its patterns ("a minion army as a multiplier", "bank the resource", "search by the resource's whole
    family") belong in a pattern library that every run reads, so the next run doesn't learn them again. That library
    is the game-knowledge layer the user described (feedback study §3).

**Added by the user (2026-10-18):**

13. **Look for nodes that change a standard rule.** Some ascendancy notables, and keystones, rewrite how a standard
    mechanic works, and a researcher wouldn't think to look for them. Way of the Stonefist (Martial Artist, node 39595)
    turns the gloves you equip into Fists of Stone and their explicit modifiers into more powerful related modifiers,
    which makes gloves a slot to build around. The pinned PoB ignores all three of its lines, so it can't be measured
    there. The remedy:
    - a lens in the pattern library;
    - a short list of every such node, one sentence each: what rule it changes and what that makes valuable, with
      whether PoB models it. It is written once per pin from the tree's text (the 22 ascendancies' 209 notables come
      to about 2,800 words), and redone when the pin moves.
    - A new league's rule changers reach the poe2db digest (remedy 3) before PoB has them.
    - **Uniques too, as one index with the nodes** (agreed with the user, 2026-10-18). Most builds use at least one
      unique for its rule change, and the cleverest combine two or more. The pinned PoB holds 435 unique entries,
      about 21,400 words, which is too many to load in every session.
      - **Built once per pin, on disk, never loaded whole.** Each rule-changing unique gets an entry:
        - the rule it changes, in a sentence, with its original lines;
        - what it creates (conditions or resources) and what it pays off on, in a small vocabulary of mechanic
          families;
        - its explicit penalties only, such as "-40% to Fire Resistance" or "you can no longer regenerate Life by any
          other means";
        - whether PoB models it, its slot and its level.

        The index says once that most uniques give up the resistances, life and defences a rare provides; entries
        don't repeat it (the user).
      - **Two ways in.** The build's own ascendancy nodes and the keystones are small enough to read whole. Uniques
        are searched by mechanic: "what creates X?", "what pays off on X?", a few hundred tokens a question.
      - **Pairs come from a join.** A script joins what one entry creates with what another pays off on, ahead of
        time, across uniques, nodes and gems. In the Varashta run, Powered by Verisium creating Infusions would have
        been one join away.
      - **The compile still judges the trade.** PoB measures effective HP and resistances with the unique in place
        of the rare; for a unique it doesn't model, the entry warns that only an estimate is possible.
      - **Price is not a popularity signal.** A unique's price is popularity plus rarity: one that drops only from a
        pinnacle boss is dear, and a widely used one that drops anywhere can cost a few chaos (the user).

### 7.3 Where they go

- **The engine-lens amendment:** 1, 3 (brought forward: the poe2db digest), 4–9, 11 and 13.
- **The feedback amendment (gates as interviews):** 2 and 10, and clear speed in each card's pitch: how it clears, how
  many buttons, how fast it moves between packs.
- **The pattern library:** 12, starting with this study's patterns.

## 8. Caveats

- Navira's guide is for 0.5.5. Our pin is PoB2 v0.23.1 with 0.5.4 data (boss data 0.5.5).
- The rebuilt Navira group is our model (PG-51). The guide's newer PoB may model the granted group differently.
- Only the endgame variants are compared by number. The campaign variants aren't comparable (§3).
- Prices aren't compared. Ours are unknown (rate-limited), and Navira's guide gives none.
