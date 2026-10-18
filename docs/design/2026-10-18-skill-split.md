# Splitting the build-guide skill: design

**Status: DRAFT, 2026-10-18,** for the user's review; revised the same day after an independent review. Nothing here
is binding. Each extraction it proposes would
become its own amendment, with decisions, work units and tests, once the user picks it.

**Where it comes from.** The Varashta run's feedback (`../build-guide/studies/2026-10-17-varashta-run-feedback.md`
§3) and the comparison with Navira's guide (`../build-guide/studies/2026-10-17-varashta-comparison.md` §6, "The
skill-split idea"). Amendment 7's triage table sends "the tool's users, the skill split" here.

## 1. The problem

`/build-guide` serves one use: an open brief goes in, and a guide comes out at the end. The user listed seven kinds of
player who would use the tools differently (feedback study §3). In short:

1. a novice with little game knowledge;
2. an intermediate player who knows the core build and wants non-obvious synergies;
3. a player with an in-game character, exported to PoB2, who wants to improve it;
4. an advanced player who wants to explore options and hand off the PoB2 editing;
5. a guide author with a finished endgame build, who wants the progression, the loadouts and the guide written;
6. a player with only an endgame PoB2 file, who wants a guide for their own use;
7. a player who wants to change a community build: other gameplay, or cheaper gear.

The pipeline is built for user 1, the one of least value: that player can follow someone else's guide. The brief's
`like` field and amendment 7's seed card (a card written from a build the user names) serve user 7 in part.

Two of the user's points shape the answer:

- **The value is the game knowledge layered on the tools,** not the tools. An agent with only the pob2 tools isn't
  useful and may give bad advice.
- **A hands-free build generator isn't practical.** Without a complete and accurate PoE2 encyclopedia, an unattended
  agent won't find the best build. So every piece keeps the user in the loop, as amendment 7's gates already do.

## 2. The proposal

Split the skill into pieces a player or a general agent can use alone. `/build-guide` stays, and calls the pieces in
the order it does today. The user named five pieces; this design adds two:

| Piece | What it does | Today's parts | Users |
|---|---|---|---|
| **Game knowledge** (the base) | How to reason about PoE2 builds: the pattern library, how to look things up, what counts as evidence, what PoB gets wrong | `patterns.md`, `lookups.md`, `source-markers.md`, `pob-gaps.md`, the legacy rule (D-395) | every user, and every other piece |
| **Discovery** | Finds candidate builds for a brief or a seed, and deals them as cards | the three brainstorm researchers (R1a), the deck step (R1a-assemble), the card compiles (R1b) and their comparison table (R1b-assemble), the brainstorm gate | 2, 4, 7 |
| **Research** | Answers one question about the game, with sources | the researcher's method, the gate question step (Q) | every user |
| **Review** | Reads a build and reports what's wrong or missing, read-only | the claim verifier (V4), the run checker's build checks, `validate_build` | 3, 5, 6, 7 |
| **Compile** | Turns a plan into PoB2 loadouts for every stage, and measures them | the endgame design (D1) and the campaign design (D2), `compile_plan` | 4, 5, 6 |
| **Writer** | Writes the guide from a compiled plan | the guide writer (W1), the guide template | 5, 6 |
| **Pricing** | Prices a build's gear, and finds cheaper gear | `pricing.md`, the price steps | 3, 7 |

The two additions:

- **Game knowledge as the base.** It is what makes the other pieces worth using, and it is the layer the user said
  the project is for. Facts about the game stay in the server and in the committed reference data (`data/`, where
  amendment 8 puts its league digest and rule-changer index); how to reason about them goes here.
- **Pricing as its own piece.** It already has its own reference and rules (amendment 5), and users 3 and 7 want it
  without a guide.

**Review stays independent:** its own read-only agent, as V4's verifier is today. A reviewer that also designs
starts to grade its own work.

## 3. How the pieces fit together

- **The run folder's files are the interfaces.** Every format is already written down: `run-folder.md`,
  `plan-reference.md`, the card and deck formats (`../build-guide/studies/2026-10-18-wu81-formats.md`), the reports
  (`source-markers.md`). A piece states which files it reads and which it writes. Run alone, it works in its own
  folder, starting from whatever the user brings: a PoB file, a plan, a card or a question.
- **Each piece is a skill with its own contract:** when to use it, what it needs, what it writes, and which safety
  rules apply. Today the runner's Bash allowlist and write rules live in `build-guide`'s `SKILL.md`. They move to one
  shared file, and each piece names the rules it needs from it.
- **The agent types stay four,** with wider descriptions. Today each says "started only by the build-guide skill's
  runner". After the split, any of the pob2 skills may start them.
- **The game knowledge is read, not run.** Other pieces read its files by path, as stages read `lookups.md` now.
  Its own `SKILL.md` covers a general agent answering a game question.
- **The checks split with the pieces.** `check-run.mjs` holds checks for every stage today. Each piece keeps the
  checks on its own files, and `/build-guide` runs them all, as it does now.
- **One plugin, later.** The server, the skills and the agents could ship as one Claude Code plugin. That is
  packaging, and it waits until two pieces stand alone.

## 4. Extract one piece at a time

The user's direction: extract the pieces one at a time. Each extraction is a refactor of `/build-guide` plus a new
way in: its behaviour doesn't change, and its tests pass with only their file paths updated.

Expect about one server item per extraction. The Varashta run alone found three (the legacy flag, rare monster
modifiers, and a PoB-to-plan tool).

| Order | Piece | Why then | Its server item |
|---|---|---|---|
| 1 | Game knowledge | It's a move of files with no change in behaviour. Amendment 8 (the engine-lens amendment) adds most of its new content: its facts go in `data/`, which doesn't move, and its library entries move once, with the library. | none (amendment 8's digest and index are scripts and data) |
| 2 | Review | It is small, read-only and useful alone. A review run on Navira's PoB would have flagged the uncapped campaign resistances, the over-reserved Spirit and the 12 gem groups over PoB's limit of 9. | the load warning for dropped supports (D-398, in this batch); maybe a sweep over every loadout in a file |
| 3 | Compile and writer, with a PoB-to-plan tool | Users 5 and 6 together, the guide author's path. The comparison was this path done by hand: import a PoB, rebuild what PoB drops, measure, compare. | a tool that reads a PoB file into a plan, a new tool (HG-12, the user's call on any change to the tool surface) |
| 4 | Pricing | Small; users 3 and 7. | the trade site's 429 handling (the trade-429 item) |
| 5 | Discovery and research | Last, because the engine-lens amendment reshapes them most. | whatever the engine-lens amendment leaves |

**Each extraction is done when:**

- `/build-guide` behaves as before: the pipeline fixtures, the static tests and the scripts' tests pass, with path
  pins updated and no assertion weakened;
- the piece runs alone on at least one real case;
- the piece has a test set built from real misses (below).

**A test set per piece, from real misses:**

- **Game knowledge:** the misses so far. Powered by Verisium was missed by searching "Cold Infusion" rather than the
  whole Infusion family. Way of the Stonefist is a rule change no researcher looked for. Legacy gems were kept
  with a risk note, because nothing said legacy means not in the game.
- **Review:** the three flaws in Navira's PoB above. The public repository can't hold the file, so the fixtures
  rebuild each flaw from the game data.
- **Compile:** a tree-granted group that loses its supports on load (PG-54, D-398). The 15-stage plan fixture is
  there already.

## 5. What it costs, and what can go wrong

- **More words loaded.** A piece run alone must state its own rules, so some rules exist in two places. Keep the
  rules in one place and have each piece point to it, as stage references do now.
- **Pinned text moves.** `tests/static/buildGuidePipeline.test.ts` pins skill text by path. Every move updates the
  pins in the same commit.
- **Picking the wrong skill.** With eight pob2 skills (seven pieces and `/build-guide`), a general agent may load
  the wrong one. Each skill's
  description says when not to use it.
- **The spec has to follow.** Slice 03 describes one pipeline. Each extraction's amendment adds a section for the
  piece's contract, and the next fold makes it binding.

## 6. Choices for the user

Each has a recommendation and a real alternative.

1. **The first extraction.** Recommended: **game knowledge, right after amendment 8 is built.** Its facts are in
   `data/` already, so only the library and the reasoning files move, once. The alternative is **review first**, the
   smallest piece with standalone value, which serves four of the seven users.
2. **The guide author's path (users 5 and 6) needs a PoB-to-plan tool.** Recommended: **design it in the
   compile-and-writer extraction**, step 3. The alternative is a spike now, to learn how much of a guide author's PoB
   maps onto our plan format, before anything depends on it.
3. **Packaging as a plugin.** Recommended: **after two extractions.** The alternative is now, which settles the file
   layout before anything moves twice.
