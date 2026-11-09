# Slice 04: Game knowledge, the first piece of the skill split

**Status: written current 2026-11-06 (WU-149, D-504), as built at M-28; updated 2026-11-09 for amendment 16's M-29
(WU-158, D-525): the running-league rule and the Bash line; and for its M-30 (WU-167, D-525): the description's three
new commands, the checker's tag and the overlay's scripts.** Part of the project spine,
[`docs/spec/README.md`](../../spec/README.md) ("spine"), which wins any disagreement; fold fixes back into it. It
covers the game-knowledge piece (D-503, contract C-58): its files, the plugin layout it lives in (C-57) as far as the
piece uses it, its work units WU-145 (the file moves), WU-147 and WU-149, all built, and WU-150 (human, recorded: HG-37 passed),
and its acceptance criteria AC-W120, AC-W124, AC-W125, AC-W128 and AC-W129. Its source is amendment 15
(`amendment-15-plugin-and-knowledge.md`, approved 2026-11-06, cited "a15 §n"), §4, §8, §9 and §13 to §17, with the
work-log's record of M-28 (`../worklog.md`, "WL:n"), which wins where the build differs from the amendment's text.
Since M-29 it also covers what amendment 16 (`amendment-16-pieces-and-launch.md`, approved 2026-11-08, cited "a16
§n") changed in the piece: the running-league rule (D-507, contract C-59; a16 §3) and the Bash line (D-515; a16 §11),
built by WU-151 and WU-156 (their game-knowledge parts), with this update, WU-158; their criteria AC-W132 (its
game-knowledge part), AC-W142 and AC-W143; and AC-W140, the agent types' probe (WU-157, not run). The work-log's record
of M-29 (WL:7030 on) wins where the build differs. Since M-30 it covers amendment 16's other changes in the piece: its
description's three new commands (D-519; a16 §12, §15), its rules tagged `game-knowledge` in the one checker (D-516,
C-61) and the overlay's scripts and command in its folder (D-523, C-66; a16 §19), built by WU-159, WU-162, WU-163 and
WU-166 (their game-knowledge parts), with this update, WU-167; their criteria AC-W153's and AC-W159's game-knowledge
parts and AC-W161. The work-log's record of M-30 (WL:7449 on) wins where the build differs. The three new pieces are
slices 05, 06 and 07 ([`05-compile.md`](05-compile.md), [`06-pricing.md`](06-pricing.md),
[`07-writer.md`](07-writer.md)). Paths are root-relative: from the repository root, which is the plugin root (C-57).

## 1. Scope

Game knowledge is how to reason about Path of Exile 2 builds: the pattern library, how to look things up, what
counts as evidence for a claim, what PoB gets wrong, and the legacy rule (a15 §8). It is one of the seven pieces of
`/pob2:build-guide` that the skill-split design names (`docs/design/2026-10-18-skill-split.md` §2), and the first to
stand alone: a player or an agent asks it a game question with `/pob2:game-knowledge <question>`, and the other pieces
read its files by path.

In scope:
- the piece's `SKILL.md`, its three references, its three data builders and, since M-29, the league rule's module and
  command `leagues.mjs` (C-59), in `skills/game-knowledge/`; since M-30 also the overlay's module `overlay.mjs` and the
  digest script's `--running` mode, which the `bin/` command `pob2-league-digest` runs (D-523, §2.3);
- the questions it answers: how a mechanic, gem, unique, passive or ascendancy works for a build; what is new in the
  running leagues; whether PoB models something; what counts as evidence for a claim;
- its real cases (§6), the piece's own test set.

Out of scope, each with its home:
- designing a build from a brief, or a guide from the player's own PoB file: `/pob2:build-guide` (slice 03);
- measuring or improving the player's own PoB file: `/pob2:compile` since M-30 (slice 05); a review of a PoB file: no
  pob2 skill yet, review comes with amendment 17 (D-506). Until M-30 neither had a pob2 skill, and `/pob2:build-guide`
  started from a brief only;
- prices: `/pob2:pricing` since M-30 (slice 06); until then pricing was inside `/pob2:build-guide`;
- a guide for a build already designed: `/pob2:writer` since M-30 (slice 07);
- the committed game data itself (`data/`, C-35) and PoB's gaps list (`docs/build-guide/pob-gaps.md`): they stay
  where they are, and the piece reads them (a15 §8);
- the checks on its files (`check-run.mjs`'s source tags, offline tag, markers and claim kinds): they stay in the one
  checker, which since M-30 tags them `game-knowledge` and checks them in every run, a piece run's included (D-516,
  C-61; slice 03 §6's note).

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
- **The committed data** (`data/`): the running leagues' digests, `data/league/<slug>.md` (D-400), which the league
  command lists (below; D-507); the rule-changer index, `data/rules/` (`nodes.md`, `uniques.md`, `gems.md`,
  `pairs.md`, `vocabulary.md`; D-401); the monster table, `data/monsters/monster-mods.md` (D-402). Read whole with
  Read, searched with `grep` through Bash (D-515).
- **The league command,** `node <root>/skills/game-knowledge/scripts/leagues.mjs [--at <instant>]` (C-59, D-507;
  `${CLAUDE_PLUGIN_ROOT}` for `<root>` in the skill's text): it prints the running leagues' digests, newest first,
  with each one's line 3 (§2.3's league rule). It reads only, and it is in the runner rules' Bash list
  (`runner-rules.md`:69–71). Since M-30 it takes `--league <league folder>` too, a run's runner passing the server's
  league folder so that a digest made on the user's side is listed (D-523, §2.3); game knowledge's own runner starts no
  run, gets no league folder and passes none (a16 §19).
- **PoB's gaps and bugs:** `docs/build-guide/pob-gaps.md`, by `grep` for a name; a PG entry found goes with the answer.
- **PoB's source,** under `vendor/PathOfBuilding-PoE2/src/Modules/`, by `grep`, when the checkout holds it, for how
  PoB computes something.
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
`skills/build-guide/references/stages/README.md`, the checker and three agent definitions. Since M-29 the league rule
is game knowledge's too: `skills/build-guide/scripts/run-log.mjs` imports `runningDigests` from `leagues.mjs` (:196)
for the run log's `digest` list and the `digests:` line `init` and `resume` print; build-guide's runner rules,
`start.md` and `run-log.md` name the command; and `lookups.md` (:125–127) and `patterns.md` (:591–592) name the task
header's `digests` or the command's list where they used to read "the newest" digest.

### 2.2 What it writes

Nothing. It writes no file, starts no agent, changes no engine build (no pob2 tool beyond the five lookups: nothing
that loads, adds, sets, toggles or compiles), and prices nothing (no trade, exchange or currency-rate call). Its answer
is the session's reply.

**The Bash line** (D-515, as built at M-29, WU-156): the runner searches with `grep` through Bash, as the runner rules
allow (`runner-rules.md`:47–50: reading commands only, no redirection and nothing that writes), and Reads a file whole
(`SKILL.md`:16); every other search line in the skill names `grep` the same way, the league bullet's too (WU-151's
rebase round). Its Bash runs only those reads and the league command (§2.1). Amendment 15's "You need no Bash: Read,
Grep and Glob make every read" is gone: in this Claude Code a session with Bash has no Grep or Glob tool (a16 §11),
as the M-28 real cases' agents found (§6). An agent a piece starts searches with Grep and Glob; no agent definition
names Bash (R-4, D-515).

### 2.3 The rules it follows

- **Where an answer starts:** each kind of question names the file or tool it starts from (the skill's "Where each
  kind of question starts"): the lookups for how a named thing works; "Supply by family" for what supplies a resource,
  a charge, a buff, a ground effect or an ailment; "A rule changer" and the index for a node, keystone, gem or unique
  that changes a standard rule; the running leagues' digests for the league (the league rule, below); the monster
  table for a monster's or a beast's modifier; `source-markers.md` for evidence.
- **The league rule** (D-507, C-59; as built at M-29, WU-151): a league is running from its start instant until its
  end instant, both UTC, read against the machine's clock as a UTC instant, never a local date; so 1.0 counts from
  2026-12-11 20:00 UTC, the instant both 0.5 leagues stop. A digest records its league's instants in the `League:`
  sentence on its line 3 (`League: from <YYYY-MM-DD HH:MM> UTC until <YYYY-MM-DD HH:MM> UTC.`, or `… until no end
  announced.`); one with no sentence isn't running, and its reader names it once ("<path> records no league dates:
  re-run its digest script"). For "what is new in the league", the runner takes the running digests from the league
  command, each head whole and newest first, the body by `grep` (`SKILL.md`:66–72); an ended league's digest only when
  the user asks about that league; a league not yet started from poe2db.tw as announced content, never a digest; and,
  as before, poe2db.tw past a digest's fetch date or with no digest for the league asked about. With no running digest
  the command prints "No running league has a league digest: what is new in it isn't in the committed data."
  (`leagues.mjs`:43). The two committed digests carry their sentences by hand: Runes of Aldur from 2026-05-29 20:00 UTC
  and Forbidden Rites from 2026-09-04 20:00 UTC, both until 2026-12-11 20:00 UTC (`data/league/*.md`:3).
  `league-digest.mjs` writes the sentence from poe2db's homepage cards and rewrites the other digests' in its output
  folder (a16 §3); `--reflag` keeps it.
- **A digest made on the user's side** (D-523, C-66; as built at M-30, WU-166): a running league can also have a
  digest in the server's league folder, `<stateDir>/league/`, which `guide_run {new_run}`'s reply names. At a pipeline
  or piece run's start, online and not under `--test`, the runner runs `pob2-league-digest --running --out <league
  folder>`, the fifth `bin/` command, which runs `league-digest.mjs`'s `--running` mode alone and refuses the
  maintainer's modes (a security review's finding, WL:7612–7618). When no running digest exists, or the newest records
  no end, it reads poe2db's homepage cards at most once a UTC day, kept in the league folder, and makes the digest of
  each running league that has none, at D-497's pace; a failed page is recorded and not fetched again that UTC day
  (WL:7652–7653, :7694). `--out` must be an existing folder named `league` whose real path isn't under the plugin
  root, so it never writes `data/league/`. Beside every digest it writes, `league-digest.mjs` writes the sidecar
  `<slug>.overlay.json` (`overlay.mjs`; a16 Appendix A.11): the league's socketables and uniques the pin doesn't
  define, each socketable's `type` from its name, matching the pin's type for all 287 of its socketables (WL:7640–7643,
  :7695–7696), its slot keys from `data/league/rune-slots.json`; `--reflag` prints the entries the pin now defines,
  which retire. `runningDigests` takes both folders, a committed digest replacing a user-side one of the same league;
  a run's `init` and `resume` record it, and the task header's `digests` carries its absolute path. The server's use
  of the sidecars, the overlay, is slice 01's note and the spine's C-66.
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
   there. Since M-29 `scripts/` also holds `leagues.mjs`, the league rule's module and command (C-59, D-507), which a
   runner runs as `node <root>/skills/game-knowledge/scripts/leagues.mjs`. As built (WL:7087–7089, :7182–7183): that
   command is exempted from amendment 15's check that every run command is a `bin/` command (AC-W115,
   `tests/static/amendment15Paths.test.ts`:112–117), a departure from amendment 15's rule, forced because a16 §3 and
   C-59 give the command that form (the coordinator's call). Since M-30 `scripts/` also holds `overlay.mjs` (D-523), and
   one data builder has a `bin/` command: `pob2-league-digest` runs `league-digest.mjs --running --out <league
   folder>` alone, for a run's runner (C-57's fifth command, amending D-499's "no command for the data builders" for
   this one, a16 §19); every other mode stays a maintainer's `node` command.
2. **The command** is `/pob2:game-knowledge`, the plugin `pob2`'s (C-57); the bare `/game-knowledge` works once the
   plugin is installed.
3. **Its `SKILL.md`** has fewer than 150 lines (D-505); its frontmatter holds `name` and `description` only. The
   description says when to use it (the four kinds of question, §1) and when not: designing a build from a brief
   (`/pob2:build-guide`); measuring or improving the player's own PoB file (`/pob2:compile`), what its gear costs or
   which rung it sits on (`/pob2:pricing`), a guide for a build already designed (`/pob2:writer`); a review of a PoB
   file isn't a pob2 skill yet; prices. Each later piece's amendment adds its own command to that list (a15 §8): since
   M-30 (WU-162, D-519) the three new commands are named, the description 760 characters, `SKILL.md` 126 lines.
4. **It reads the shared rules first** and after a compaction (D-501).
5. **It reads only** (§2.1) **and writes nothing** (§2.2).
6. **Its web is poe2db.tw only,** at D-497's pace (choice 1).
7. **Each claim carries a source tag** from `source-markers.md`; what it couldn't confirm is said once, with its
   fallback (§2.3).
8. **It carries the legacy rule** (D-395).
9. **Its references keep their text** except paths, moved once (WU-145) from build-guide's folder; build-guide's
   stages read them at their new paths.
10. **Its real cases pass** (§6): each, asked of a fresh agent as §6 says, gets the expected answer with a source tag.
11. **It reads the running leagues' digests** (D-507, M-29): the list the league command prints, never one digest by
    its fetch date; an ended league's only when the user asks about it; a league not yet started from poe2db.tw as
    announced content; the poe2db.tw fallback kept (§2.3).
12. **Its runner searches with `grep` through Bash** and Reads a file whole (D-515, M-29); the skill never says it
    needs no Bash; it stays under 150 lines (§2.2).

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
  test: `tests/static/amendment15GameKnowledge.test.ts`. **Holds** (WU-147, merged at `176366f`; 121 lines). Since
  M-30 the description names `/pob2:compile` for the player's own file and `/pob2:pricing` and `/pob2:writer` for the
  rest, so the test's description check follows (WU-162's AC-W162 list: D-519, C-58 amended; WL:7797).
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

Amendment 16's M-29 criteria for this piece (a16 §25):
- **AC-W132 (the readers; WU-151), game knowledge's part.** `skills/game-knowledge/SKILL.md` and
  `skills/game-knowledge/references/lookups.md` name running leagues and no longer choose "the newest" digest "by its
  fetch date"; game knowledge keeps its poe2db fallback and reads an ended league's digest only when the user asks.
  Static test: `tests/static/runningLeagueReaders.test.ts` ("game knowledge takes the running digests from
  leagues.mjs, reads an ended league's only when asked, and keeps its poe2db fallback", with the readers' phrase
  check). **Holds** (WU-151, merged at `b62158f`). The rule itself, `runningDigests` at set instants, is AC-W130's
  (`tests/unit/runningLeagues.test.ts`), and the digest script's dates AC-W131's (`tests/unit/leagueDigest.test.ts`).
- **AC-W140 (the agent types' search; WU-157).** For each of the four `pob2:` types, the work-log records one Grep and
  one Glob call that returned results, in a `--plugin-dir` session (HG-38). Recorded. **Open:** not run; WU-168
  records it at the latest.
- **AC-W142 (the Bash line; WU-156).** `skills/game-knowledge/SKILL.md` no longer says "You need no Bash", tells its
  runner to search with `grep` through Bash, and stays under 150 lines; no agent definition names Bash (R-4). Static
  test: `tests/static/amendment15GameKnowledge.test.ts` ("AC-W142 (WU-156, D-515): …"), whose no-Grep check covers the
  league bullet too since WU-151's rebase round (WL:7103–7105). **Holds** (WU-156, merged at `e0166a2`; WU-151 at
  `b62158f`; 125 lines).
- **AC-W143 (M-29's documents; WU-158).** This slice states the running-league rule and the Bash line; slices 01, 02
  and 03 carry a16 §21's notes for M-29; the spine names C-59 and C-60; `specSpine.test.ts` passes; the gate's verifier
  records M-29's rows built and the status line (the spine test checks only the folded number). Static tests:
  `tests/static/amendment16Docs.test.ts` (new) and `specSpine.test.ts`; and a record. **Holds** (WU-158), the record
  the gate verifier's.

Amendment 16's M-30 criteria for this piece (a16 §25):
- **AC-W153 (`/pob2:compile`; WU-162), game knowledge's part.** Game knowledge's description names the three new
  commands. Static test: `tests/static/compileSkill.test.ts`, with `tests/static/amendment15GameKnowledge.test.ts`'s
  AC-W124 description check, which follows it. **Holds** (WU-162, merged at `fda5b5d`).
- **AC-W159 (the overlay; WU-166), game knowledge's part.** From fixture pages the digest script writes a16 Appendix
  A.11's sidecar, with `type` and `statOrder`s; `rune-slots.json` maps every in-pin socketable label of
  `runes-of-aldur.md` to `Data/ModRunes.lua`'s keys; a retired entry is reported by `--reflag`; `--running` runs only
  when no running digest exists or the newest records no end, reads the cards once a UTC day, fetches only running
  leagues without a digest at D-497's pace, no cookie, writes only its league folder, and nothing offline; a user-side
  digest reaches `init` and the header; `bin/` holds five executable commands. Unit and static tests:
  `tests/unit/leagueOverlay.test.ts` (the sidecar from fixture pages; `--running`; the `bin/` command runs `--running`
  alone; a user-side digest reaches `init` and the header), `tests/static/leagueOverlay.test.ts` (`rune-slots.json`
  against the pinned corpus; the fifth command and the runner's lines) and `tests/unit/leagueDigest.test.ts`. The
  server's part, the engine tests, is slice 01's note. **Holds** (WU-166, merged at `857f34a`).
- **AC-W161 (M-30's documents; WU-167).** Slices 05, 06 and 07 exist with this slice's headings; slice 03 carries a16
  §21's notes; the spine names C-61 to C-66; `specSpine.test.ts` passes; the gate's verifier records the rows built
  and the status line "Folded through amendment 16". Static tests: `tests/static/amendment16Docs.test.ts` (its AC-W161
  blocks) and `specSpine.test.ts`; and a record. **Holds** (WU-167), the record the gate verifier's.

AC-W115 (every root-folder path in `skills/` and `agents/` resolves, the old forms banned) and AC-W116 (the pipeline
unchanged) cover this piece's files with the rest of the plugin; they are slice 03's and C-57's. From M-29 every build
unit also holds AC-W162: every pipeline fixture gives the checker's result it gave at `cf16e07`, and each changed test
assertion is listed with the decision that forces it (WL:7077–7081, :7177–7185 for this piece's files; at M-30,
WL:7796–7797, :7813–7817 and :7624–7630, with WU-166's two at its fix round, :7696–7698).

## 5. Work units

Status lines give the commits on the integration branches: `build-guide/m28` (the work-log's M-28 section, WL:6542
on), `build-guide/m29` (its M-29 section, WL:7030 on) and `build-guide/m30` (its M-30 section, WL:7449 on; remapped to
the signed commits at HG-8). The units' order is the spine's M-28, M-29 and M-30 lines (§9.3).

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

### WU-151: running leagues (game knowledge's part)
- kind: build
- status: built (four commits on `b475db9`, merged at `b62158f`)
- depends-on: []
- touches (this piece's part): [`skills/game-knowledge/scripts/leagues.mjs` (new), `league-digest.mjs` (the cards and
  the `League:` sentence, the other digests' rewrite), `data/league/runes-of-aldur.md` and `forbidden-rites.md` (line 3
  by hand), `tests/fixtures/poe2db/league/home.html` (hand-written cards), `skills/game-knowledge/SKILL.md` (the
  league bullet, :66–72), `references/lookups.md`, `references/patterns.md`; `tests/helpers/runningDigests.ts`
  (replacing `newestDigest.ts`)]
- produces: [the league rule, C-59]
- acceptance: [AC-W130, AC-W131, AC-W132; the run log's, the checker's and build-guide's readers are slice 03's]
- milestone: M-29
- summary: The rule and its readers (a16 §3). As built (WL:7082–7089, :7103–7107, :7165–7176): the `digests:` report
  that `init`, `resume` and `leagues.mjs` print; the test clock `BUILD_GUIDE_TEST_NOW`; "the same league" is the same
  file name; a card with no start slot writes no sentence; the league bullet searches with `grep`, so the AC-W142
  check covers it; `leagues.mjs`'s main guard compares real paths, so the command works through a symlinked root; the
  command exempted from AC-W115's `bin/` rule (§3, requirement 1); skill revision 15.

### WU-156: the small fixes (game knowledge's part)
- kind: build
- status: built (one commit on `34426a7`, merged at `e0166a2`)
- depends-on: []
- touches (this piece's part): [`skills/game-knowledge/SKILL.md` (the Bash line, :16, and its other search lines but
  the league bullet), `tests/static/amendment15GameKnowledge.test.ts` (the AC-W142 block; :187's pin of the removed
  "You need no Bash" sentence)]
- produces: [the Bash line, D-515]
- acceptance: [AC-W142; its AC-W139 and AC-W141 are slice 03's and C-35's]
- milestone: M-29
- summary: The skill's runner searches with `grep` through Bash (a16 §11). As built (WL:7052–7058, :7062–7067): the
  `amendment15GameKnowledge.test.ts`:187 change sits outside the spine's touches row, which WU-158 adds.

### WU-157: the agent types' Grep and Glob
- kind: human, then the coordinator
- status: not run; WU-168 records it at the latest
- depends-on: [the user's `--plugin-dir` session (HG-38)]
- touches: [the work-log]
- acceptance: [AC-W140]
- milestone: M-29 (outside its gate)
- summary: In a session the user starts with `claude --plugin-dir` on the main checkout, the coordinator starts each
  of the four `pob2:` types with one task, a Grep for a fixed line of a committed file and a Glob for a committed
  folder, and records the calls (a16 §11).

### WU-158: M-29's documents
- kind: docs
- status: built (2026-11-09)
- depends-on: [WU-151…WU-156]
- touches: [this slice (the league rule, the Bash line), notes in `01-server-tools.md`, `02-plan-compiler.md` and
  `03-pipeline.md`, `docs/spec/README.md`, `tests/static/amendment16Docs.test.ts` (new),
  `skills/build-guide/references/pricing.md`:450 (a wording fix)]
- acceptance: [AC-W143]
- milestone: M-29
- summary: This slice's M-29 update; the notes in slices 01 to 03 for the patches, the granted-quality rule and the
  league rule; the spine's M-29 rows as built, its status line "Folded through amendment 16 (approved; as built
  through 15 and amendment 16's M-29)" (a16 §21).

### WU-162: `/pob2:compile` (game knowledge's part)
- kind: build
- status: built (four commits on `99c8905`, one a fix round; merged at `fda5b5d`)
- depends-on: [WU-159, WU-161]
- touches (this piece's part): [`skills/game-knowledge/SKILL.md` (the description's three commands, the "Stay on the
  question" bullet), `tests/static/amendment15GameKnowledge.test.ts` (the AC-W124 description check)]
- acceptance: [AC-W153's game-knowledge part; the rest of WU-162 is slice 05's]
- milestone: M-30
- summary: The description routes the player's own file to `/pob2:compile`, its prices to `/pob2:pricing` and a
  finished build's guide to `/pob2:writer`, and says a review of a PoB file isn't a pob2 skill yet (a16 §12, §15; C-58
  amended). `SKILL.md` 126 lines.

### WU-166: the overlay (game knowledge's part)
- kind: build
- status: built (four commits on `9331522`: phase 1, two fix rounds and phase 2; merged at `857f34a`)
- depends-on: [WU-159; merged after WU-165]
- touches (this piece's part): [`skills/game-knowledge/scripts/league-digest.mjs` (the sidecar, `--running`,
  `--command`), `overlay.mjs` (new), `leagues.mjs` (`--league`), `data/league/rune-slots.json` (new), `bin/pob2-league-digest`
  (new), `tests/fixtures/poe2db/overlay/` (new), `tests/unit/leagueDigest.test.ts`, `tests/unit/leagueOverlay.test.ts`
  and `tests/static/leagueOverlay.test.ts` (new)]
- acceptance: [AC-W159's game-knowledge part; the server's part is slice 01's note and C-66's]
- milestone: M-30
- summary: §2.3's user-side digest, as built (WL:7619–7635, :7649–7664, :7688–7699, :8113–8133): `type` from the name,
  matching the pin's 287 socketables; the sidecar holds only the pin's missing entries, a multi-variant unique skipped
  and listed; a fresh `statOrder` above the pin's largest; the `bin/` command `--running` only, into an existing
  `league` folder outside the plugin root; a failed page recorded per UTC day. **AC-W162's list** (each forced by
  D-523): `leagueDigest.test.ts` (AC-W70's `--from` file list gains the sidecar, both `--reflag` stdout pins the retired
  line, "prints the entries added" three times, AC-W131's filter compare without the sidecar's lines, "reads nothing
  when the newest running digest records its end" on an empty `league` folder), `amendment15Layout.test.ts`'s `bin/`
  listing (C-57's fifth), `runSettingsExample.test.ts`'s allow list, `buildGuidePipeline.test.ts`'s Bash-list regex and
  the wrapper text pin (`--command`).

### WU-167: M-30's documents
- kind: docs
- status: built (2026-11-09)
- depends-on: [WU-159…WU-166]
- touches: [`docs/build-guide/spec/05-compile.md`, `06-pricing.md`, `07-writer.md` (new), this slice (the description's
  commands, the checker's tag, the overlay's scripts), notes in `01-server-tools.md`, `02-plan-compiler.md` and
  `03-pipeline.md`, `docs/spec/README.md`, `docs/build-guide/pob-gaps.md` (PG-116), `skills/writer/SKILL.md`:62 (a
  wording fix), `tests/static/amendment16Docs.test.ts`]
- acceptance: [AC-W161]
- milestone: M-30
- summary: The three pieces' slices, written current; slice 03's notes and shrink; this slice's M-30 update; the notes
  in slices 01 and 02; the spine's M-30 rows as built, its status line "Folded through amendment 16" (a16 §21).

## 6. Real cases

The piece's own test set, from real misses (the design's §4). **How they're asked** (a15 §8): the coordinator asks
each of a fresh general-purpose agent, giving it the piece's `SKILL.md` text with `${CLAUDE_PLUGIN_ROOT}` replaced by
the tree's absolute path, and telling it to use only Read, Grep, Glob and the five lookup tools, with no web; the
gate's verifier checks its recorded tool calls. A wrong answer is asked once more of another fresh agent; a second miss
is fixed in the piece's files and the case asked again (R-117). **Amended by D-515 (M-29):** a piece's real cases are
asked of a `pob2:` agent type, never of a general-purpose agent, which has Bash and so no Grep in this Claude Code
(a16 §11); the M-28 runs below were asked the old way.

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
