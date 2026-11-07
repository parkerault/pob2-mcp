# Slice 04: Game knowledge, the first piece of the skill split

**Status: written current 2026-11-06 (WU-149, D-504), as built at M-28.** Part of the project spine,
[`docs/spec/README.md`](../../spec/README.md) ("spine"), which wins any disagreement; fold fixes back into it. It
covers the game-knowledge piece (D-503, contract C-58): its files, the plugin layout it lives in (C-57) as far as the
piece uses it, its work units WU-145 (the file moves), WU-147 and WU-149, all built, and WU-150 (human, recorded: HG-37 passed),
and its acceptance criteria AC-W120, AC-W124, AC-W125, AC-W128 and AC-W129. Its source is amendment 15
(`amendment-15-plugin-and-knowledge.md`, approved 2026-11-06, cited "a15 §n"), §4, §8, §9 and §13 to §17, with the
work-log's record of M-28 (`../worklog.md`, "WL:n"), which wins where the build differs from the amendment's text.
Paths are root-relative: from the repository root, which is the plugin root (C-57).

## 1. Scope

Game knowledge is how to reason about Path of Exile 2 builds: the pattern library, how to look things up, what
counts as evidence for a claim, what PoB gets wrong, and the legacy rule (a15 §8). It is one of the seven pieces of
`/pob2:build-guide` that the skill-split design names (`docs/design/2026-10-18-skill-split.md` §2), and the first to
stand alone: a player or an agent asks it a game question with `/pob2:game-knowledge <question>`, and the other pieces
read its files by path.

In scope:
- the piece's `SKILL.md`, its three references and its three data builders, in `skills/game-knowledge/`;
- the questions it answers: how a mechanic, gem, unique, passive or ascendancy works for a build; what is new in the
  league; whether PoB models something; what counts as evidence for a claim;
- its real cases (§6), the piece's own test set.

Out of scope, each with its home:
- designing a build from a brief: `/pob2:build-guide` (slice 03);
- checking or improving a PoB file the player has: no pob2 skill yet; review comes with amendment 17 (D-506), and
  `/pob2:build-guide` starts from a brief, never from a file;
- prices: pricing, a piece of amendment 16 (D-506), today inside `/pob2:build-guide`;
- the committed game data itself (`data/`, C-35) and PoB's gaps list (`docs/build-guide/pob-gaps.md`): they stay
  where they are, and the piece reads them (a15 §8);
- the checks on its files (`check-run.mjs`'s source tags and `data` citations): they stay in build-guide's checker
  until amendment 16 sorts the checks by piece (a15 §8, §18).

## 2. The contract

C-58 in the spine is the binding summary; this section gives its detail as built.

### 2.1 What it reads

- **The shared rules first:** `skills/build-guide/references/runner-rules.md`, read whole before anything else and
  again after a compaction (D-501). Of those rules, the `.env` rule and the network apply as written; the rest come
  down to what the piece never does (§2.2).
- **Its references,** in `skills/game-knowledge/references/`, moved by WU-145 from build-guide's folder, their text
  unchanged but for paths (AC-W120):
  - `patterns.md`, the pattern library (C-53): the searches "Supply by family" and "A rule changer", and the entries
    a "why does this work" question starts from;
  - `lookups.md`, the lookup set ("The lookup set L"), the coverage check's reading table and the legacy rule
    (D-395);
  - `source-markers.md`, the source tags and the three claim rules (C-30, D-273). It stays whole here, its V4 report
    form included, until review moves (amendment 17).
- **The committed data** (`data/`): the league digest, `data/league/<slug>.md` (D-400); the rule-changer index,
  `data/rules/` (`nodes.md`, `uniques.md`, `gems.md`, `pairs.md`, `vocabulary.md`; D-401); the monster table,
  `data/monsters/monster-mods.md` (D-402). Read with Read and Grep.
- **PoB's gaps and bugs:** `docs/build-guide/pob-gaps.md`, by Grep for a name; a PG entry found goes with the answer.
- **PoB's source,** under `vendor/PathOfBuilding-PoE2/src/Modules/`, by Grep, when the checkout holds it, for how PoB
  computes something.
- **The five lookup tools,** which read only: `lookup_game_data`, `check_model_coverage`, `search_tree_nodes`,
  `list_gems` and `get_classes` (as `mcp__pob2__…`, the user's own server registration until amendment 18, C-57).
- **The web:** poe2db.tw only, with WebFetch, for what the lookups and the committed data don't hold (such as an entry
  newer than the digest), at the league digest's pace (D-497): one request at a time, at least 3 s apart, no cookie,
  one retry after 60 s on a 429 or 5xx, nothing fetched twice. No WebSearch and no other host (the user's choice 1,
  a15 §19).

The other pieces read the same files by path. Today that is `/pob2:build-guide`: `patterns.md` from `SKILL.md`,
R1a, R1a-synthesize, R1a-assemble, R1b, D1-build, `start.md`, the card template and the researcher's definition;
`lookups.md` from `SKILL.md`, Q, `runner-rules.md`, `skills/build-guide/references/stages/README.md` and the
researcher's and coordinator's definitions; `source-markers.md` from `SKILL.md`, R1a, V4, `run-folder.md`,
`skills/build-guide/references/stages/README.md`, the checker and three agent definitions.

### 2.2 What it writes

Nothing. It writes no file, starts no agent, changes no engine build (no pob2 tool beyond the five lookups: nothing
that loads, adds, sets, toggles or compiles), and prices nothing (no trade, exchange or currency-rate call). It needs
no Bash: Read, Grep and Glob make every read. Its answer is the session's reply.

### 2.3 The rules it follows

- **Where an answer starts:** each kind of question names the file or tool it starts from (the skill's "Where each
  kind of question starts"): the lookups for how a named thing works; "Supply by family" for what supplies a resource,
  a charge, a buff, a ground effect or an ailment; "A rule changer" and the index for a node, keystone, gem or unique
  that changes a standard rule; the newest digest for the league; the monster table for a monster's or a beast's
  modifier; `source-markers.md` for evidence.
- **Search wide:** the whole family and its substitutes, from every kind of source, never one member; one lookup per
  term it can't place; skills as well as mods; an index entry, a pair or a study is a lead, confirmed by a lookup;
  the committed data searched before it says no source holds a fact.
- **Does PoB model it:** the coverage check (a partly parsed line applies none of itself; "possibly unread" is
  unconfirmed, since only a measurement settles it), the index's `PoB models it:`, and PoB's gaps.
- **The answer:** plain words first, each name before its id; a source tag on every claim, in the research
  footnote's form without the marker (`[pob-data | lookup_game_data gem "<name>"]`, `[data | rules/nodes.md#<id>]`,
  `[external | <poe2db.tw URL> | accessed: … | confidence: …]` and the rest); the three claim rules; what it couldn't
  confirm said once, with its fallback, never "test it in game"; a design request sent to `/pob2:build-guide`.
- **Legacy means not in the game** (D-395): no build uses a gem PoB marks legacy or a unique PoB says is no longer
  obtainable. The lookups leave both out and name them; `compile_plan` refuses them. Its home moved here from
  build-guide's hard rules (WU-147), and `runner-rules.md` points to `lookups.md` for it.
- **Without the lookups** (the pob2 server not connected): it says so once, answers from the committed files alone
  (the game data, its references and PoB's gaps), and names the lookups that would confirm the rest. (As built,
  WL:6665–6666, :6722–6723; a15 §8 doesn't state it.)
- **Paths:** a root-relative path in its references is under `${CLAUDE_PLUGIN_ROOT}`, which Claude Code replaces in
  the skill's text with the plugin root (D-500).

## 3. Requirements

1. **One folder** (D-499, D-503): `skills/game-knowledge/` holds `SKILL.md`, `references/` (`patterns.md`,
   `lookups.md`, `source-markers.md`) and `scripts/` (`rules-index.mjs`, `league-digest.mjs`, `monster-mods.mjs`).
   The data builders are maintenance commands, run from the repository with `node skills/game-knowledge/scripts/<x>.mjs`
   and no `bin/` command; their output headers name their new paths, and `CLAUDE.md`'s pin-upgrade step 7 runs them
   there.
2. **The command** is `/pob2:game-knowledge`, the plugin `pob2`'s (C-57); the bare `/game-knowledge` works once the
   plugin is installed.
3. **Its `SKILL.md`** has fewer than 150 lines (D-505); its frontmatter holds `name` and `description` only. The
   description says when to use it (the four kinds of question, §1) and when not: designing a build from a brief
   (`/pob2:build-guide`); checking or improving a player's PoB file (no pob2 skill yet, and never `/pob2:build-guide`);
   prices. Each later piece's amendment adds its own command to that list (a15 §8).
4. **It reads the shared rules first** and after a compaction (D-501).
5. **It reads only** (§2.1) **and writes nothing** (§2.2).
6. **Its web is poe2db.tw only,** at D-497's pace (choice 1).
7. **Each claim carries a source tag** from `source-markers.md`; what it couldn't confirm is said once, with its
   fallback (§2.3).
8. **It carries the legacy rule** (D-395).
9. **Its references keep their text** except paths, moved once (WU-145) from build-guide's folder; build-guide's
   stages read them at their new paths.
10. **Its real cases pass** (§6): each, asked of a fresh agent as §6 says, gets the expected answer with a source tag.

## 4. Acceptance criteria

- **AC-W120 (game knowledge's files; WU-145).** `patterns.md`, `lookups.md` and `source-markers.md` are under
  `skills/game-knowledge/references/` and differ from their `a8d735c` text only in paths (a test normalizes the paths
  and compares); the three data builders are under `skills/game-knowledge/scripts/` and their tests pass; their output
  headers name the new paths; `rules-index.mjs check` passes on `data/rules/`; `CLAUDE.md`'s step 7 names the new
  path. Static and unit tests: `tests/static/amendment15Layout.test.ts` ("AC-W120 (WU-145, D-503): game knowledge's
  six files") and `tests/unit/amendment15Commands.test.ts` (its data builders' block), with the builders' own
  `tests/unit/rulesIndex.test.ts`, `leagueDigest.test.ts` and `monsterMods.test.ts`. **Holds** (WU-145, merged at
  `1fee40a`).
- **AC-W124 (its `SKILL.md`; WU-147).** `skills/game-knowledge/SKILL.md` exists with fewer than 150 lines; its
  description names `/pob2:build-guide` for designing a build from a brief and says no pob2 skill yet checks or
  improves a player's PoB file; it tells its runner to read `runner-rules.md` first; it carries the legacy rule; it says
  root-relative paths are under `${CLAUDE_PLUGIN_ROOT}`; its web scope is the one the user picked (choice 1). Static
  test: `tests/static/amendment15GameKnowledge.test.ts`. **Holds** (WU-147, merged at `176366f`; 121 lines).
- **AC-W125 (its real cases; WU-147).** Each of §6's three cases, asked as §6 says, gets the expected answer with a
  source tag, and the agent's recorded tool calls are only Read, Grep, Glob and the five lookup tools; the questions,
  answers and tool calls are recorded in the work-log, where the gate's verifier checks them. A wrong answer is asked
  once more of another fresh agent; a second miss is fixed in the piece's files and the case asked again. M-28 needs
  all three passed. Work-log rows (WL:6667–6698), checked by WU-147's gate verifier (WL:6711–6718). **Holds:** all
  three passed at the first ask.
- **AC-W128 (the documents; WU-149).** This slice exists with the headings Scope, The contract, Requirements,
  Acceptance criteria, Work units and Real cases; slice 03's §7.3 and §7.6 carry notes pointing here; the spine names
  C-57 and C-58 and amendment 15's rows as built, its §4.3 holds the old-to-new path line, and its status line reads
  "Folded through amendment 15"; `tests/static/specSpine.test.ts` passes. Static tests:
  `tests/static/amendment15Docs.test.ts` and `specSpine.test.ts`. **Holds** (WU-149).
- **AC-W129 (the user's install; WU-150, after M-28).** The work-log records HG-37: the permission mode, and whether
  reads outside the working directories were already allowed; the plugin installed from the main checkout lists
  `/pob2:build-guide`, `/pob2:game-knowledge` and the four agent types; and, in a session started from an empty
  folder, `/pob2:game-knowledge` answers §6's case 3, and whether an approval was asked for a plugin file. A prompt
  goes to amendment 18 (R-114) and doesn't fail HG-37. Human. **Holds** (HG-37 passed 2026-11-07; WL:6827–6872).

AC-W115 (every root-folder path in `skills/` and `agents/` resolves, the old forms banned) and AC-W116 (the pipeline
unchanged) cover this piece's files with the rest of the plugin; they are slice 03's and C-57's.

## 5. Work units

Status lines give the commits on the integration branch `build-guide/m28` (the work-log's M-28 section, WL:6542 on).
The units' order is the spine's M-28 line (§9.3).

### WU-145: the plugin layout and every path (game knowledge's part)
- kind: build
- status: built (six commits on `39229fc`, merged at `1fee40a`)
- depends-on: []
- touches (this piece's part): [`skills/game-knowledge/references/` (`patterns.md`, `lookups.md`,
  `source-markers.md`, moved), `skills/game-knowledge/scripts/` (the three data builders, moved), the data headers
  (`data/rules/pairs.md` regenerated offline; `data/league/runes-of-aldur.md` and `data/monsters/monster-mods.md`
  edited by hand), `src/plan/monsterMods.ts`:5, `CLAUDE.md`'s step 7]
- produces: [the piece's folder, without its `SKILL.md`]
- acceptance: [AC-W120; the rest of WU-145's criteria are slice 03's and C-57's]
- milestone: M-28
- summary: Move the six files straight from build-guide's folders, so no file moves twice (a15 §4). The rest of the
  unit (the manifests, `skills/build-guide/`, `agents/`, `bin/`, the hook, every path rewrite, the load check) is
  C-57's.

### WU-147: game knowledge's `SKILL.md`, the legacy rule's move, its real cases
- kind: build
- status: built (three commits on `b0c395c`, merged at `176366f`)
- depends-on: [WU-146]
- touches: [`skills/game-knowledge/SKILL.md` (new), `skills/build-guide/SKILL.md` (the legacy bullet dropped from
  its hard rules), `tests/static/amendment15GameKnowledge.test.ts` (new), `buildGuidePipeline.test.ts` (the legacy
  pin moved); the real cases' rows in the work-log (the coordinator's)]
- produces: [`/pob2:game-knowledge`]
- acceptance: [AC-W124, AC-W125]
- milestone: M-28
- summary: Write the skill to §2 and §3 (121 lines, 1,524 words at the doer's commit). As built (WL:6659–6666,
  :6719–6725): the legacy rule under "Legacy means not in the game"; the line for a session without the lookups (§2.3);
  the test checks the web scope's one host, allowing one mention of a web search (the "No WebSearch …" sentence), and
  refuses every other server tool by its bare or prefixed name but `compile_plan`, named as what refuses legacy content;
  the load check's `plugin details` lists both skills, the four agents and `SessionStart`, the always-on cost about
  1,122 → 1,362 tokens.

### WU-149: the documents
- kind: docs
- status: built (2026-11-06)
- depends-on: [WU-147, WU-148]
- touches: [`docs/build-guide/spec/04-game-knowledge.md` (new), `docs/build-guide/spec/03-pipeline.md` (notes at
  §7.3 and §7.6), `docs/spec/README.md`, `tests/static/amendment15Docs.test.ts` (new)]
- acceptance: [AC-W128]
- milestone: M-28
- summary: This slice, written current; 03's two notes; the spine's amendment 15 rows as built, its status line's
  parenthesis dropped (the fold rule).

### WU-150: the user's install and read check
- kind: human
- status: recorded (2026-11-07; HG-37 passed; WL:6827–6872)
- depends-on: [M-28's merge to `main`]
- touches: [the work-log]
- acceptance: [AC-W129]
- milestone: M-28
- summary: From the main checkout, the user adds the marketplace and installs the plugin, then asks
  `/pob2:game-knowledge` §6's case 3 in a session started from an empty folder (HG-37). Its result goes to amendment
  18 (R-114).

## 6. Real cases

The piece's own test set, from real misses (the design's §4). **How they're asked** (a15 §8): the coordinator asks
each of a fresh general-purpose agent, giving it the piece's `SKILL.md` text with `${CLAUDE_PLUGIN_ROOT}` replaced by
the tree's absolute path, and telling it to use only Read, Grep, Glob and the five lookup tools, with no web; the
gate's verifier checks its recorded tool calls. A wrong answer is asked once more of another fresh agent; a second miss
is fixed in the piece's files and the case asked again (R-117).

1. **"A cold spell build wants Infusions. What can supply them?"** Expected: the search covers the whole Infusion
   family, and the answer names Powered by Verisium (`patterns.md`'s "Supply by family"; the Varashta run's miss).
   **Passed** at the first ask (WL:6690–6697): the search covered gems by mechanic and by type, uniques, passives,
   mods, constants, Verisium Infusions, Remnant buffs and the monster table, and the answer named Powered by Verisium
   ("4 Verisium Infusions per cast, which can be used in place of any Elemental Infusions"), tagged
   `[pob-data | lookup_game_data gem "Powered by Verisium"]` and `[data | rules/gems.md#powered-by-verisium]`.
2. **"Which Martial Artist ascendancy nodes change a standard rule a build could be built around, and does PoB model
   them?"** Expected: Martial Master (61586), Runic Meridians (39552) and Way of the Stonefist (39595), each not
   modelled, Way of the Stonefist's glove transform cited to PG-36 (`data/rules/nodes.md`). **Passed** at the first
   ask (WL:6680–6689): the three, none modelled, each tagged to `rules/nodes.md`, Martial Master also to
   `check_model_coverage node 61586`, Way of the Stonefist to PG-36.
3. **"Can a build use the gem Commandment?"** Expected: no; PoB marks it legacy, and legacy means not in the game
   (D-395; the gem lookup says "Left out: Commandment, which PoB marks legacy"). **Passed** at the first ask
   (WL:6673–6679): no, tagged `[pob-data | lookup_game_data gem "Commandment"]` and `[data | lookups.md]`. HG-37
   asks it again of the installed plugin (AC-W129).

As run (`8ff65ff`, WL:6667–6672, :6711–6718): each agent's tool calls were Read, ToolSearch (only to load the five
lookups' schemas) and the lookups; case 1 made 59, case 2 35, case 3 7. The harness gave those agents no Grep or Glob,
so they read with Read alone, and case 1 didn't read the league digest (it couldn't list the folder to find its file
name).
