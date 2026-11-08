# Amendment 16: the pieces that start from a PoB file, and launch day

**Status: DRAFT, revision 1, 2026-11-07.** Revision 1 folds the independent review of revision 0 (§31: five lenses,
three skeptical verifiers; 115 raw findings, 58 material clusters, 4 of them refuted). Nothing here is approved until
the user approves it.

The second amendment of the skill split (D-506). It formalizes two milestones, as the user asked ("1. two milestones",
§1): **M-29**, what the 1.0 launch on 2026-12-11 needs and the fixes every piece shares; **M-30**, the pieces that start
from a player's PoB file (compile, pricing and the writer), with the tool that reads a PoB file into a plan. Its
sources:
- the user's words, quoted in §1, from the work-log (`docs/build-guide/worklog.md`, cited WL:n) and the user's rulings
  of 2026-11-06 and 2026-11-07;
- amendment 15 §11 (`amendment-15-plugin-and-knowledge.md`, cited a15 §n), this amendment's scope in the approved
  roadmap (D-506) and its open points;
- four read-only surveys of the repository at `cf16e07` (2026-11-07, in the coordinator's session folder, not
  committed): compile, the writer and a PoB file read into a plan ([A]); pricing, piece runs, the checker and words
  loaded ([B]); league choice, new items on the user's side and the pin upgrade ([C]); bridge patches ([D], its search
  sections moot, §11). Each claim taken from them cites a file and line; the load-bearing ones were re-read for this
  draft;
- the accepted design, `docs/design/2026-10-18-skill-split.md` (cited [design]);
- the project spine, `docs/spec/README.md`, folded through amendment 15, and PoB's bugs, `docs/build-guide/pob-gaps.md`
  (PG ids) and `docs/build-guide/pob-upstream.md`.

Still deferred, by the user on 2026-11-02 (amendment 14's header): tuning the trade pacing, charge generation, charms
and timeless jewels. Review, discovery and research stay amendment 17's; the server in the plugin, its setup and the
live test stay amendment 18's (D-506).

It is written against the spine folded through amendment 15. Paths are root-relative (the repository root is the plugin
root, C-57). Decisions continue from D-507, work units from WU-151, criteria from AC-W130, risks from R-118, gates from
HG-38, contracts from C-59, PoB gaps from PG-115 (this amendment adds none); the milestones are M-29 and M-30. Every id
was checked against the spine: none is taken.

**Names.**
- A **piece run** is a piece started by its own command on what the user brings, writing in its own folder,
  `Guides/<piece>/<date>-<n>/` (a15 names, D-506). A **file run** is a `/pob2:build-guide` run that starts from a PoB
  file instead of a brainstorm (§18).
- The **file reader** is the new server tool that reads a PoB file into a plan, `plan_from_build` (§13, C-62). A
  **read plan** is the plan it writes; its one stage is the **read stage**.
- An **owned** item, group or tree jewel is one the file reader took from a player's file and the design hasn't
  replaced: the character's own, with its exact rolls (§13).
- A **running league** is one whose start instant has passed and whose end instant, if one is recorded, hasn't (§3).
- A character is **below the endgame** when its level is under 65, the first waystone tier's area level
  (`data/enemies/waystones.json`'s offset 64 plus 1), or its owner says it is in the campaign (choice A, §30).
- A **bridge patch** corrects a PoB bug in our bridge, `pob-api/`, never in `vendor/` (§5). Its **fingerprint** is the
  sha1 of the PoB code it relies on (§5). Its **retirement test** fails once the pin's own code no longer has the bug.
- The **upgrade script** is `scripts/pin-upgrade.mjs`, the scripted part of `CLAUDE.md`'s pin-upgrade procedure (§4).
- A buff **switched as needed** is in the plan and the guide but off in the measured numbers, with when to switch it
  on and what to switch off for it (§14).
- The **ladder** is the three endgame rungs `m` (entering maps), `b` (budget) and `n` (non-budget). **Placing** a plan
  on it gives its stage a rung (§16). The **replace cost** is what the gear costs to buy again at the same must-have
  stats (§16).
- The **better round** is a design round on a read plan toward the pipeline's targets, within the user's budget (§17).
- The **file card** is the card the measure step writes from a read plan, so the steps that read a card run on a file
  (§15).
- The **overlay** is the new league's socketables and uniques the server adds to PoB's data, from a digest's
  **sidecar**, a JSON file the digest script writes beside it (§19).

## 1. The user's direction

- 2026-11-06, on the fix policy (WL:6519–6530): the coordinator's advice was accepted, "Yes to both": PoB bugs that
  change our numbers or break the pipeline are fixed as bridge patches, each with a test that fails once the pin fixes
  it; `vendor/` stays unmodified; an upstream PR only where PoB's `dev` lacks a fix, each approved by the user first.
- 2026-11-06, on an imported character (a15 §1): "I imagine the most common use case will be users importing their
  game character to PoB, then pointing the skill at that file." And: "I want to make sure our skill's tests won't
  reject a build that works in-game." And: "it's common for characters to have multiple spirit gems that can't all be
  activated at the same time, and toggle them with weapon sets or as needed. We'll need the designers to be able to
  support that use case."
- 2026-11-07, on the league (WL:6856–6860, :6886–6887): default to the most recent league; never one not yet started
  (poe2db already lists 1.0); "read every digest whose league is running today, newest first; never one not yet
  started; an ended one only when asked."
- 2026-11-07, on PoB's lag after a launch (WL:6895–6898): the user wants the gap handled for a new league's first days:
  "Fold into amendment 16" (`amendment-16-candidates`).
- 2026-11-07, on the words loaded: no preference, the coordinator's call (WL:6868–6869). On `claude -p`: never, anywhere
  (WL:6870–6871).
- 2026-11-07, the nine questions (WL:6924–6931), verbatim: "1. two milestones; 2. (a) first. For (b), we can't assume
  that the import will be the top budget rung. The pricing stage should determine that, or the user can say the rung if
  trade is unavailable. If the user wants a better build *and* a guide (a likely scenario in my estimation), run a
  design round on it first (I don't see anything in this list covering the "make my character better" use case), then
  build the guide from that. 3. yes; 4. Keep as set, but call out anything that seems wrong to the user; 5. take
  recommended; 6. both; 7. My PoB file; 8. I can confirm that players can upgrade skill quality in granted skills. The
  method may vary between skills, but it's always allowed; 9. keep it. No objections to your calls."
- 2026-11-07, the real cases (WL:6962–6983): ResurrectForbidden, a character's unmodified poe.ninja export, the
  coordinator's pick at the user's "You can pick one"; and CullTheConquerer, one of the user's characters imported with
  PoB2's own OAuth importer: "I didn't change anything after the import". Both are in `~/pob2-real-cases/`, a folder
  outside every git repository and off the Windows drive, which agents may read.

The questions' numbers, for the sections that cite them: (1) the milestones; (2) the uses: (a) the imported character
read into a plan as owned, measured and priced, first; (b) a guide from a file, placed on the ladder, never assumed the
top rung; the new "make my character better"; (3) the file reader, granted (HG-12); (4) a file's configuration; (5)
Spirit buffs switched as needed (the recommendation taken); (6) pricing gives both the replace cost and upgrades within
a budget; (7) the real cases are the user's own files; (8) a granted skill's quality; (9) new items on the user's side,
kept, last in M-30. **The coordinator's calls, accepted** ("No objections to your calls", WL:6931; the calls at
WL:6951–6961): league choice by start and end instants recorded in each digest; the upgrade script for the mechanical
steps, tagged releases only, ours to run; the gem-group recount by the game's rule; the rune-roll bug fixed on both
sides; a fingerprint per patch; the reader handling PG-108, PG-110 and PG-111 and asking for the main skill (PG-113) and
which buffs stay on (PG-107); each stage's words loaded counting its own reference; a character's items kept as owned, a
guide's rares as must-have stats; piece runs in `Guides/<piece>/<date>-<n>/` with a `piece` field and the checker's
rules tagged by piece; a stopped pricing run resumed after the lockout as the retry; no search tool; `prices.json`'s
labels corrected.

What follows from these:
- **M-29 is what 1.0 needs, and must be built well before 2026-12-11 20:00 UTC.** At that instant both running leagues
  end and 1.0 starts (§3); the readers must not read a league that ended or one not yet started, and our pin must be
  upgradable in hours once PoB2 releases 1.0's data (§4). PoB2's first release has come 4.5 hours before a launch to 3
  days after (mean about 30 hours, WL:6895–6898).
- **The pieces start from the user's file, not from a brief.** The main case is an imported character: its state
  today, real rolls and all, not a planned endgame (a15 §11).
- **Nothing assumes where the file sits on the ladder.** Pricing places it, or the user names its rung without trade
  (answer 2).

## 2. The system today

From the surveys, at `cf16e07`:
- **League choice.** One rule picks one digest: the newest by the fetch date on its third line
  (`skills/build-guide/scripts/run-log.mjs`:923–937, recorded as the log's `digest` at :648 and in each resume at :951;
  re-implemented in `tests/helpers/newestDigest.ts`:9–23). R1a reads "the newest league's" digest
  (`skills/build-guide/references/stages/R1a.md`:121), game knowledge "the newest league digest … by its fetch date"
  (`skills/game-knowledge/SKILL.md`:66). With `forbidden-rites.md` fetched on 2026-11-07, both now read its 19 entries
  and not Runes of Aldur's 324, though both leagues are running [C §1.1]. No digest records a league's start or end
  (`league-digest.mjs` reads no `data-displaytime`, [C §2]); poe2db's homepage cards carry both (Appendix A.1). Trade's
  league is a separate notion (D-20, `src/trade/league.ts`:1–32) and `src/` never reads a digest [C §1.2].
- **The pin** is v0.23.1, still PoB2's latest release, about 98 merged PRs behind `dev` (`pob-upstream.md`:3–4). It has
  never been upgraded. `CLAUDE.md`'s seven steps are by hand; S-2's internals probe was never committed
  (`docs/stabilization/spikes/S-2-pin-v0.23.1.md`:69–71) [C §5].
- **One bridge fix exists,** `pob-api/API/ParseFixes.lua` (D-492): a data fix applied at bootstrap step 5c
  (`pob-api/bootstrap.lua`:77–83) whose engine test fails once PoB parses the line itself
  (`tests/integration/parseFixes.test.ts`:142–182). Nothing fingerprints a PoB function; the only function guard is the
  existence check on `UpdateGlobalGemCountAssignments` (`pob-api/API/BuildOps.lua`:30), which skips silently [D §1].
- **PoB's bugs in our path** (`pob-gaps.md`, "Found in amendment 15" and "Checked from PoB2's tracker"): PG-106, a
  support in a granted skill counts its group against the skill slots (`Classes/SkillsTab.lua`:1570–1608); PG-107, an
  import turns every skill on; PG-108, an import holds each granted skill twice; PG-109, a saved item's ranged rolls
  move when it holds a rune (save numbers rune lines, `Classes/ItemsTab.lua`:1228–1233; load skips them, :1118); PG-110,
  an item on a base the pin lacks is dropped silently; PG-111, 19 base names defined twice keep the last; PG-113, an
  import's main group is the one with most gems; PG-114, a granted skill gets quality 0
  (`Modules/CalcSetup.lua`:1525–1530). PG-65 (Herald of Blood's explosion flags) and PG-112 (ours: node power's cache)
  are not in this amendment (§5).
- **No way in for a player's file.** `compile_plan`'s `read_back` and `adopt` take only a file the server wrote for that
  plan (a15 §2). Read-back's engine-free parser, `parsePobXml` (`src/services/readBack.ts`:110–188), reads specs, items,
  item sets, skill sets and config sets, and pairs loadouts by PoB's rule, but omits much a player's file needs
  (`readBack.ts`:27–79; §13) [A §4]. Node names and the ascendancy split come engine-free from the tree
  service (`src/handlers/planHandlers.ts`:298–328). A build code decodes engine-free (`src/utils/buildCode.ts`).
- **The pipeline's rules would reject an owned item.** A rare is a spec (must-haves at their tiers' lowest rolls,
  nothing crafted); V1's `sockets` and `affix-cap` (`src/plan/checks/v1.ts`:1389, :1541–1563), the checker's
  `rare-title` (`skills/build-guide/scripts/check-run.mjs`:6579) and its charm rule (`checkFlasks`, :6495–6499) fail
  real crafted, corrupted, fractured or over-range items and filled charm slots [A §4]. The plan schema requires a
  producer and uptime for each earned config state and a data citation for each scenario value
  (`docs/build-guide/plan-reference.md`:1124, :1131).
- **Spirit by weapon set works; "as needed" can't be planned.** A group has only `enabled`, which is what PoB measures
  [A §7].
- **Pricing is coordinator steps inside the pipeline** (R1b, D1-build, D1-finish, D1-gate, D2), keyed to `m`, `b` and
  `n` and writing `prices[]` in `plan.json`; `find_upgrades` needs the loaded build; a stop is retried only at a gate
  after its display (`run-log.mjs`:848–861) [B §1].
- **The run log** requires a brief and a slug (`run-log.mjs`:556–557, `check-run.mjs`:2847–2849); its flow check
  (`checkFlow4`, `check-run.mjs`:3752) and layout (`KNOWN_TOP`, :1195) are the pipeline's. `guide_run {new_run:
  "<piece>"}` already makes `Guides/<piece>/<date>-<n>/` (`src/utils/guidesPath.ts`:25, :239–303) [B §3].
- **The checker** is one 7,357-line file; its rule names are the tests' pins [B §4].
- **Words loaded** count, for each stage, every file its agent definition names; the coordinator's step table names all
  12 coordinator stage references (`agents/build-guide-coordinator.md`:116–134), so each coordinator stage counts all of
  them (`scripts/words-loaded.mjs`:280–286) [B §5].
- **`data/economy/prices.json`** labels every league `"patch": "0.5.x"`, gives the two running leagues no end and has no
  1.0 entry (:68–102) [B §2].
- **`/pob2:build-guide`'s `SKILL.md`** is 317 lines (the bound 349 at M-28, the user's 325 by the split's end); game
  knowledge's is 121 [B §6].
- **Search.** The four agent types list Read, Glob and Grep and leave out Bash (`agents/*.md`:4), which in this Claude
  Code gives them Grep and Glob; a session with Bash has neither (WL:6907–6915), so game knowledge's "You need no Bash"
  (`skills/game-knowledge/SKILL.md`:16) is wrong for its runner (§11).

# Part I. M-29: what 1.0 needs, and the shared fixes

## 3. D-507: league choice by running leagues

**The rule.** A league is running from its start instant until its end instant, both UTC: it is running at an
instant `now` when `now` is at or after its start and, if an end is recorded, before its end. `now` is the machine's
clock read as a UTC instant, not a local date (the user's rule, WL:6886–6887; the coordinator's call, accepted). So 1.0
counts from 2026-12-11 20:00 UTC, and both 0.5 leagues stop counting at that instant.

**Where the instants live: the digest's line 3.** `league-digest.mjs` writes a sentence after the fetch date:
`League: from <YYYY-MM-DD HH:MM> UTC until <YYYY-MM-DD HH:MM> UTC.`, or `… until no end announced.` (Appendix A.1).
The fetch-date regex the readers use today still matches (`run-log.mjs`:933). It reads them from poe2db's homepage,
which it already fetches first ([C §2]):
- **The cards.** The homepage has a row of league cards apart from the section blocks. Each card has a header, a
  `<small>` version label (`1.0`, `0.5.5`, `0.5`) and two slots, each a `data-displaytime` (Unix seconds) and a label
  under it. A slot labelled "Running for" or "Starts in" is the start; "Ends in" is the end; any other label is an
  event, not a league time, and is ignored (the 1.0 card's first slot is "ExileCon Day2", 2026-11-07 17:45 UTC; its
  start is the "Starts in" slot, 2026-12-11 20:00 UTC) [C §2, the saved homepage].
- **The match.** A card belongs to the section whose `<small>` ends with the card's version label: the card names
  aren't the section names ("Return of the Ancients" against "Runes of Aldur", "Release" against "Conquerors of
  Wraeclast"), but the versions match on all three [C §2]. A section no card matches gets no `League:` sentence, and
  the script says so.
- **The other digests.** In the same run, with no further request, the script rewrites the `League:` sentence of every
  other digest in its output folder whose card the homepage shows, and prints each change; a digest whose card is gone
  keeps what it has. So making a new league's digest also records the end the older leagues were given. `--reflag`
  keeps the sentence.
- **The two committed digests** get their sentences by hand from the saved homepage, as amendment 15 edited the
  digests' headers by hand to avoid a fetch (a15 §5): Runes of Aldur from 2026-05-29 20:00 UTC and Forbidden Rites
  from 2026-09-04 20:00 UTC, both until 2026-12-11 20:00 UTC (WL:6883–6886). The script's test homepage
  (`tests/fixtures/poe2db/league/home.html`) gains hand-written cards; no saved page is committed (D-400 as built).

**The readers, one rule.** A shared module, `skills/game-knowledge/scripts/leagues.mjs`, exports
`runningDigests(folders, now)`: every digest in the folders whose league is running at `now`, the latest start first,
then by name, a committed digest replacing a user-side one of the same league (from M-30 the server's league folder
joins `data/league/`, §19). As a command (`node <root>/skills/game-knowledge/scripts/leagues.mjs [--at <instant>]`, in
`runner-rules.md`'s Bash list) it prints the list, for a runner that knows only the date. A digest with no `League:`
sentence isn't running; its reader names it once ("<file> records no league dates: re-run its digest script"). Every
reader takes that list, never one digest by fetch date:
- **The run log** (`run-log.mjs`): from skill revision 15 (§24), `digest` is the list, newest first, possibly empty;
  `init` (:648) and `resume` (:951) record it. The top-level `digest` keeps the form of the revision `init` wrote, each
  `resumes[]` entry that of its resume, since a resume stamps an older log with the current revision (:735–746). D-415's
  line (`pinChanges`, :2262–2276) compares two lists as sets, and a string with a list's first entry: "The league
  digests changed since this run last ran". A test-only clock override sets `now`.
- **The checker** accepts, at `check-run.mjs`:2707 and :2807, each form where its revision puts it: a list of non-empty
  file names from revision 15, a string or null before.
- **The runner's staleness line** (`skills/build-guide/SKILL.md`:129–130, `references/start.md`:103–106) prints line 3
  of each running digest, newest first. With none: "No running league has a league digest: what is new in it isn't in
  the committed data." From M-30 the runner also names a running league that has no digest (§19).
- **The task header** gains `digests`, the running digests' root-relative paths (a user-side one's absolute, §19),
  newest first, which the runner copies
  from `pob2-run-log`'s output, so no agent applies the rule itself. R1a (`R1a.md`:121), the researcher's definition
  (`agents/build-guide-researcher.md`:57–60) and `skills/game-knowledge/references/lookups.md`:125 read those digests:
  each head whole, newest first, the bodies by Grep. A Grep across the whole `data/league/` folder (`patterns.md`:592)
  names the running digests instead.
- **Game knowledge** (`skills/game-knowledge/SKILL.md`:66–68): its runner takes the running digests from `leagues.mjs`,
  each head whole and the body by `grep` through Bash (§11); an ended league's only when the user asks about it; and, as
  today, poe2db.tw past a digest's fetch date or with no digest for the league asked about (the user's "say so and go to
  poe2db for what's new", `current-league-default`).
- **The tests' helper** (`tests/helpers/newestDigest.ts`) becomes `runningDigests(folders, now)`, its own implementation
  of the rule, as today's is.

**Never a league not yet started; an ended one only when asked** (the user's rule). A question that names a league not
yet started is answered from poe2db.tw within game knowledge's web scope, as announced content, never from a digest (a
proceed-on, §30). **Trade's league is unchanged for designs** (D-20): a designed plan's `league` stays the trade API's
first non-Standard league (a character is priced in its own, §16), which can differ from the digests read (Forbidden
Rites trades while both 0.5 digests are read; 0.5.5 is a league inside patch 0.5, WL:6876–6879).

Amends D-400 (the digest's line 3 and the runner's staleness line), D-412 (the log's `digest`), D-415 (its change
line), D-503 and C-58 (game knowledge's league line), C-36 (the task header's `digests`). New contract C-59 (§22).

## 4. D-508: the scripted pin upgrade

**What it is.** `scripts/pin-upgrade.mjs <tag>`, a repository script (not a plugin component, no `bin/` command),
which does the mechanical steps of `CLAUDE.md`'s "Upgrading the PoB2 pin" and stops with a list of everything that
needs judgment. It is ours to run: the coordinator runs it on a branch after the user decides to upgrade. Upgrading the
pin stays the user's decision each time (HG-11), and no user of the plugin runs it (the coordinator's call, accepted).
It commits nothing.

**Tagged releases only.** It refuses a branch, a commit or any ref that isn't a tag of `pob-pin.json`'s repository named
`v<n>.<n>.<n>` (a proceed-on on the pattern). A dev commit in launch week is out (`dev` carries regressions such as
#2529, `pob-upstream.md`:178–179 [C §5]); `POB_ALLOW_UNPINNED` stays a development escape (`src/engine/pinCheck.ts`:23).

**The mechanical steps, in order** [C §5's table]:
1. Resolve the tag's commit (`git ls-remote`) and fetch its tree into a staging folder with `scripts/fetch-pob.sh`'s
   sparse clone. That script takes no arguments and always replaces `vendor/` (:10–11, :35–36), so WU-155 gives it a
   tag-and-destination mode or runs its clone from Node, and says which. Read the new `manifest.xml` version and the
   wrapper's sha1 with `pinCheck.ts`'s `parseManifest`, exported for this (module-private, `src/engine/pinCheck.ts`:87),
   and `manifestSha1` (:51), from the compiled `build/`.
2. **S-2's internals probe, committed** as `scripts/pob-internals.lua` with its symbol list
   `scripts/pob-internals.symbols.json`: every PoB function, table and field the bridge relies on (S-2 probed 116),
   each resolved inside a loaded build and its function body hashed after whitespace normalization, as S-2 did
   (`S-2-pin-v0.23.1.md`:69–71). The script runs it on both trees and lists every symbol that changed or is missing,
   from a temporary cwd with temporary `POB_DIRECTORY` and `XDG_STATE_HOME` (`CLAUDE.md`'s probe rule), as it runs step
   8, which boots PoB too.
3. Every bridge patch's fingerprints (§5), recomputed on the new tree; each one that differs is listed with its patch.
4. Write `pob-pin.json` (`tag`, `commit`, `version`, `headlessWrapperSha1`) and the pin's literal values in the tests
   (`tests/unit/pobPin.test.ts`:19–22, :31; `tests/integration/protocol.lua.test.ts`:99, :109) [C §5].
   `tests/integration/compilePlan.test.ts`:208–209 read `pob-pin.json` from WU-155 on, as `protocol.lua.test.ts`:100
   does, since their fixture's `versionNotes` (`src/plan/record.ts`:1537–1548) would fail at every upgrade;
   `engineDescribe.test.ts`:52 is a made-up mismatch.
5. `mise run pob:fetch`.
6. **The skill-slot method:** whether `UpdateGlobalGemCountAssignments` still exists (step 5 of the procedure). The two
   tests that read PoB's warning (`tests/integration/skillSlots.test.ts`:92–95, `tests/unit/v1SkillSlots.test.ts`:50)
   find it by its text, "You have too many gem groups allocated", from WU-155 on, not at `Modules/Build.lua`:2220 and
   :2222, so no line number moves and `CLAUDE.md`'s note on them goes.
7. One full gate, `mise run test`, at `nice -n 19`; the coordinator starts the script in the background under the shared
   gate lock (the user's rule on serial gates). Its failures are sorted:
   - a patch retires only when its retirement test (A.3's `test`) fails on its "bug still present" case, whatever its
     fingerprints say (the coordinator's resolution of the review): the script removes its entry and that test, and
     re-runs the failed suites once;
   - any other failure of a retirement test (an error, a fixture that won't load, a `revert` that throws), and a changed
     fingerprint alone, are judgment: re-check, never retire;
   - a golden test's failure lists each figure, old and new; any other failure is listed as it is.
8. The rule-changer index: `rules-index.mjs candidates --json`, written for the agents who rewrite changed entries
   (amendment 8 §3), and `rules-index.mjs check`.
9. `league-digest.mjs --reflag <slug>` on each committed digest, offline; from M-30, the overlay entries the new pin
   now defines (§19). `--reflag` writes a digest only when a flag or the pin's label changes (today it re-dates line 3
   and writes every time, `league-digest.mjs`:677, :803).

**Where it stops** (Appendix A.4): a report, printed and written as `pin-upgrade-report.json` in the staging folder,
listing what needs judgment: the golden figures that moved; the probe's changed symbols; changed fingerprints and
retirement tests that failed otherwise; `pob-api/API/Trade.lua`'s mirrored ranges (`:640–669`) and `construct()`'s
check (`scripts/check-construct.lua`), each only when the PoB file it mirrors changed; a missing skill-slot method; the
tree version, when PoB's newest isn't `0_5`, whose one code literal is `scripts/check-construct.lua`:55 (the tree
service takes PoB's newest folder, `0_5` only its fallback, `src/services/treeService.ts`:69–84, and PoB keeps old
trees); the rule-index candidates that differ from the old pin's; the digests' changed flags; the fixes removed. It
exits 0 when every mechanical step ran, the gate's failures listed, and non-zero naming a step that failed.

**`CLAUDE.md`** names the script first in "Upgrading the PoB2 pin", keeps the seven steps as what it does and what is
left, and adds step 8: the bridge patches' fingerprints (§5). It gains a short **league launch** note too (the
coordinator's resolution of the review, instead of a work unit): commit the new league's digest before or at its
launch (readers skip a league not yet started, §3); re-run the digest script when poe2db's dates move, which rewrites
the other digests' sentences; correct `prices.json`'s league name and dates (§10); each with `CLAUDE.md`'s approvals.

**Before 1.0** the script runs against the pin itself (`v0.23.1` to `v0.23.1`: nothing changes, no judgment item), and,
on a scratch branch discarded after, to the release before the pin, a real difference, recording each step's result,
the judgment list and the mechanical part's elapsed time (AC-W136). A PoB release alone brings 1.0's new tree, skills
and balance; the overlay (§19) can't.

Amends C-6 (the procedure gains the script, step 8 and the launch note). Resolves HG-15's pin-upgrade item as tooling;
the upgrade itself stays HG-11's.

## 5. D-509: the PoB fix policy

**The policy** (the user, "Yes to both", WL:6519–6530):
- A PoB bug that changes our numbers or breaks the pipeline is **fixed, not only worked around**: first as a bridge
  patch in `pob-api/`, as `ParseFixes.lua` fixes a parse (D-492). Other bugs keep their workarounds in `pob-gaps.md`.
- `vendor/` is never modified.
- Each patch has a **retirement test**: it turns the patch off and shows the pin's own code still has the bug on a
  fixture; it fails once a pin fixes it, so the patch retires at that pin upgrade (§4, step 7). Its "bug still present"
  case holds only that assertion, so a setup error fails another case, and its title says to remove the patch when it
  fails, as `parseFixes.test.ts`'s does (:143).
- Each patch carries a **fingerprint** of the PoB code it relies on, checked by a static test and by the upgrade script
  (the coordinator's call (b), accepted). So a pin that rewrites that code without fixing the bug fails loudly, where a
  behaviour test alone could pass.
- **An upstream PR only where PoB's `dev` lacks a fix,** each approved by the user before it is opened.
  `pob-upstream.md` lists no PR for PG-109 (#2275, "Open; no PR", :61), so it is the one candidate; whether the
  coordinator drafts it is choice C (§30). PG-106 is fixed on `dev` (#2411); PG-114 has an open PR (#2577).

**Its two open points, settled** (`amendment-16-candidates`, items 8a and 8b, accepted): PG-109 is patched on both the
save and the load side (§7); and the fingerprints, below.

**The patches' home.** `pob-api/API/ParseFixes.lua` keeps the data fixes (parse-cache entries). A sibling,
`pob-api/API/Patches.lua`, holds the function patches: `M.PATCHES`, one entry per patch, `{pg, fingerprints, test,
apply, revert}`, `local M = {} … return M`, two-space indentation (`CLAUDE.md`'s Lua conventions). Bootstrap gains step
5d, after 5c (`pob-api/bootstrap.lua`:77–83): each entry's `apply` in its own `pcall`; a failure writes `[Patches] <pg>
not applied: <error>` to stderr and the engine starts without that patch, whose test then fails. Every function patch is
a wrap set on PoB's class table, `common.classes.<Class>`, so it reaches every instance and caller
(`Modules/Common.lua`:78–82), and its `revert` restores PoB's method; a class not yet loaded is loaded once with
`LoadModule`, as `pob-api/API/Lookup.lua`:1104–1108 loads `Item` [D §2]. An `apply` refuses when the method it wraps is
missing, so a renamed method fails loudly (`BuildOps.lua`:30's guard would otherwise call a wrap of nothing).

**The fingerprint** (Appendix A.3). Each entry, in both modules, lists what it relies on:
- for a function: `{file, func, sha1}`, `file` relative to PoB's `src/`, `func` the text of the function's definition
  line (`function SkillsTabClass:UpdateGlobalGemCountAssignments()`), and `sha1` the `manifestSha1` (PoB's CRLF scheme,
  `pinCheck.ts`:51–74) of the lines from that line to the first later line that is exactly `end`, unindented. PoB's
  methods are defined at the file's top level, so that line closes them;
- for a data line: `{file, line, sha1}`, the text that starts the line and the line's own hash. PG-103's entry gains
  one: `Data/ModCache.lua`'s entry for its line (:1356);
- for a block inside a long function: `{file, from, to, sha1}`, the texts that start its first and last lines (PG-114's,
  §8).
- **The static test** (no engine) reads each entry's file under `vendor/`, finds the line, cuts and hashes, and fails
  naming the patch, the file and what changed. It is the only startup-free check: nothing refuses to start on a
  fingerprint (the coordinator's call names a test and the upgrade script, not the pin check, `pinCheck.ts`:144–194).

**What this amendment patches**, each in its section: PG-106 (§6), PG-109 (§7), PG-114 (§8). **What it doesn't:**
PG-107, PG-108, PG-110, PG-111 and PG-113 arrive inside a player's file, so the file reader handles them (§13), and the
pipeline's own side of PG-111 (a plan's bare Shrine Sceptre gets Purity of Lightning) keeps its workaround, the
`Implicits:` line; PG-65 stays a workaround, its premise resting on an open issue (#2573); PG-112 is ours, node power's
cache, outside this policy and this amendment.

Amends D-492 (the fixes in two modules, each with fingerprints), C-6 (the procedure's step 8). Records the policy the
user approved on 2026-11-06 as a decision (`amendment-16-candidates`, item 1). New contract C-60 (§22).

## 6. D-510: PG-106, the gem-group recount

**The rule** (the game's, as the user's character shows it; `pob-gaps.md`, PG-106; the coordinator's call, accepted):
an enabled group counts against the skill slots when its first enabled active gem (not a support) isn't granted, that
is, neither the gem nor its granted effect carries `fromItem` or `fromTree`. So a support in a granted skill no longer
counts the group, and a group with no enabled active gem counts nothing. PoB counts a group once any enabled gem in it
isn't granted, supports included (`Classes/SkillsTab.lua`:1577–1582).

**The patch.** A wrap: `common.classes.SkillsTab.UpdateGlobalGemCountAssignments` calls PoB's own method, so its
lineage bookkeeping (`GlobalGemAssignments[<gem>]`, :1583–1600) stays PoB's, then overwrites
`GlobalGemAssignments.GemGroupCount` with the recount [D §2, question 3]. Both callers reach it, PoB's `UpdateGemSlots`
(:1167) and `BuildOps.get_main_output`'s refresh (`pob-api/API/BuildOps.lua`:30–32, D-428). Its fingerprint is that
method. A group the compile marks switched (§14) counts as if enabled: PoB counts only enabled groups (:1575) and a
switched group is written disabled, but a gem switched off in the game still fills a slot. The compile sets the mark at
every compile, since a reload loses it.

**What moves.** Only PoB's warning past its skill slots, which V1's `skill-slots` (`src/plan/checks/v1.ts`:73–74, :494),
`get_build_issues` and the advice report (`src/advice/report.ts`:52) all read: `GemGroupCount` has one reader,
`Modules/CalcPerform.lua`:3603 [D §2]. No figure moves. The change to those tools' output is listed in the HG-12 grant
(§28). `tests/integration/skillSlots.test.ts`'s fixture holds no granted skill, so its count of 10 stays.

**Its tests.** An engine test on a fixture holding a plain Purity of Ice group with a support, beside 9 plain groups
(the shape of PG-108's copies): the recount is 9 and PoB's warning is gone, and with one of 10 plain groups disabled and
marked switched it is 10; the retirement test turns the patch off and expects PoB's own count, 10. Upstream's fix
(#2411, "skips supports") gives the same count here, so the patch retires when a release carries it, though the two
rules differ for a group whose granted active gem comes before an ungranted one; the upgrade script's report names that
difference to re-check (`pob-upstream.md`:59) [D §2].

Amends D-428 (the count V1's `skill-slots` reads); the D-506 row's "the bridge recounting PoB's gem groups" is built
here. `pob-gaps.md`'s PG-106 workaround becomes "corrected in the bridge" (D-509).

## 7. D-511: PG-109, rune rolls on both sides

**The save side** (the coordinator's call, accepted): every PoB file the engine composes leaves out PoB's second copy
of each roll, the `<ModRange>` elements, on every item. A wrap on `ItemsTabClass:Save` (`Classes/ItemsTab.lua`:1199)
calls PoB's method and drops them from the node it built, so every composed write carries none: the compile's files,
`lua_save_build`, `export_build`, the session's snapshots and the tree-state reads, all through
`BuildOps.export_build_xml` (`pob-api/API/BuildOps.lua`:441–458) [D §3]. The item's text carries each roll already: PoB
prefixes `{range:<r>}`, rounded to three places, to every line showing a `(min-max)` (`Classes/Item.lua`:1461–1463),
and an unpatched load reads it when no `<ModRange>` overrides it (`Classes/ItemsTab.lua`:1108–1125). So desktop PoB,
unpatched, reads our files right on their first open, to that rounding.

**Three writes compose no file.** `import_build {save_as}` writes the decoded code as it came
(`src/handlers/luaHandlers.ts`:919, :936–945), so it drops `<ModRange>` by the load side's rule below; `set_build_notes`
and `compile_plan {notes_path}` edit a file's own bytes (`src/handlers/buildHandlers.ts`:412–414,
`src/plan/compiler.ts`:2036) and add none.

**The load side:** a wrap on `ItemsTabClass:Load` (:1078), which PoB hands the parsed `<Items>` node, drops the
`<ModRange>` children of every `<Item>` whose text carries a `{range:` tag, then calls PoB's method. So the rolls come
from the text on every load: a load, a reload, `analyze_build`'s and `compare_builds`' temporary loads, a snapshot's
restore. An item with no `{range:` tag (one written by an older PoB, whose rolls live only in `<ModRange>`) loads as
today.

**What it can't cover:** once the user saves a file in desktop PoB, the file again holds PoB's misnumbered copies, and
the user's next open in desktop PoB moves the rolls; only an upstream fix prevents that (§5, choice C). Our engine reads
that file right (the load side). Read-back compares item text only (`src/services/readBack.ts`:102–106), as before.

**Its tests.** An engine test saves a fixture item holding a socketed rune and ranged lines (the open-spell plan's
corrupted Liminal Coil is PG-109's probe case) and reloads it: the rolls are unchanged and the written file has no
`<ModRange>`. The retirement test runs PoB's own `Save` and `Load` with both wraps reverted and expects the moved rolls.
Fingerprints: `ItemsTabClass:Load` and `ItemsTabClass:Save`.

Amends D-399 (the export's document); the unit re-reads D-399's as-built note on files PoB didn't write against the
omission. `pob-gaps.md`'s PG-109 workaround (write a rolled line as its number) becomes "corrected in the bridge".

## 8. D-512: PG-114, a granted skill's quality

**The game fact** (the user, answer 8): "players can upgrade skill quality in granted skills. The method may vary
between skills, but it's always allowed." So a granted skill can carry quality.

**The plan says it** (plan schema 11, Appendix A.5): a stage's `skills.granted`, a list of `{skill, quality}`, the
quality of a skill an item or an allocated passive of that stage grants, 0 to 20. The compile sets it on PoB's own
group for that skill (every such group when two items grant it) after the calculation that makes the group, then
measures; `compile_check` refuses a name no item or allocated passive of the stage grants, naming the stage and the
skill. From M-30 (WU-164, skill revision 16) the designers (D1-build, D1-finish) may set quality 20 on a granted skill,
unpriced, and the guide says to raise the skill's quality to 20%, without naming a method, since the method varies
(proceed-ons, §30).

**The bridge patch** (PoB's bug: a granted skill's group is made with quality 0 and never given one,
`Modules/CalcSetup.lua`:1525–1530, `Classes/Item.lua`:2211–2222): a wrap on `SkillsTabClass:ProcessSocketGroup`
(`Classes/SkillsTab.lua`:1235), which PoB's calculation setup calls on every granted group right after making or
updating it (`CalcSetup.lua`:1542), so it reaches every calculation, the first included, by every path. For a group with
a `sourceItem` whose item passes its quality to the skill (choice E, §30), it raises the gem's quality to the item's
when that is higher. **A granted skill's quality is the larger of its group's and its item's** (the coordinator's
resolution of the review): an import's 0 never hides the item's, and a quality the compile set or a file saved stands,
since a load restores it (`SkillsTab.lua`:349), PoB keeps the group's gem between calculations, and its save writes it
(:473, :484) [D §4]. Fingerprints: `ProcessSocketGroup`, and the granted-group block of `calcs.initEnv` as a line range
(`CalcSetup.lua`:1501–1542; the function runs to the file's last line, :553–2165).

**An import's 0 is unknown.** PoB's importer starts every gem at quality 0 and sets it only from a `Quality` property
(`Classes/ImportTab.lua`:990, :1053–1054). Every plain copy of a granted skill in both real cases reads 0
(ResurrectForbidden's Purity of Ice beside its quality 10 Shrine Sceptre, CullTheConquerer's Sigil of Power beside its
quality 18 staff), so the reader writes `skills.granted` only above 0 (§13), and `pob-gaps.md`'s PG-114 gains both.

**Its tests.** A fixture with a quality 20 Shrine Sceptre (its base and its Purity named, the resistance under its cap
at quality 20): its Purity measures at quality 20 and its resistance 8 points higher than at 0
(`Data/Skills/act_int.lua`:16246, +0.4% per 1% quality; PG-114), also with the granted group saved at quality 0, an
import's shape; a plan's `skills.granted` quality of 20 on a tree-granted skill reaches its measure and still measures
20 after a save and a reload; a name nothing grants is refused. The retirement test reverts the wrap and expects
quality 0.

Amends C-31 (schema 11), C-41 (the compile and its check). `pob-gaps.md`'s PG-114 workaround becomes "corrected in the
bridge".

## 9. D-513: the words each stage loads

**The rule** (the coordinator's call after the user's "do whatever works", `amendment-16-candidates`:40; WL:6868–6869):
a stage's words loaded are the words of its agent definition, its own stage reference, and each file under `skills/` or
`agents/` the two name, less any **other** stage reference that only the definition names. A stage reference the stage's
own reference names stays (D1-finish keeps D1-build, D1-tree and D1-gate, which `D1-finish.md` names itself) [B §5].

**The change.** At `scripts/words-loaded.mjs`:285: when the source is the definition, a resolved file that is a stage
reference other than the stage's own is left out. The baseline is re-measured at `a8d735c` under the new rule, so it
stays "the same count at `a8d735c`", and committed (`scripts/words-loaded.baseline.json`): the survey's simulation
gives, for example, R1b 67,356, D1-build 82,765, D2-gate 23,812 (from baselines of 110,596, 102,373 and 77,151); R1a,
Q:researcher, V4 and W1 don't change; on today's tree every stage sits 0.5% to 1.6% under its new baseline (Q:researcher
+0.2%) with no file-list difference [B §5]. The test's own derivation (`tests/unit/wordsLoaded.test.ts`:150–155) takes
the same exclusion, and its hand-counted pins (:197–200) move to the new numbers.

**New stage references** (the pieces' `measure` and `price`, §15, §16) are found under every `skills/<piece>/references/
stages/`. No stage can have a count at `a8d735c` it didn't have, and the test compares the whole baseline with `--at
a8d735c` (`tests/unit/wordsLoaded.test.ts`:184–188), so the baseline keeps its `a8d735c` section, compared as today, and
gains a second for stages new since, each entry with the commit that adds it and compared at `--at` that commit (a
proceed-on); WU-162 and WU-163 add theirs. A file list that changes when `pricing.md` moves (§16) prints its difference,
which doesn't fail and which the gate's verifier records.

Amends D-505 (the definition of a stage's words loaded). The 5% bound and the rest of D-505 stand.

## 10. D-514: `prices.json`'s leagues

`data/economy/prices.json`'s league facts (:68–102) get their patches and the running leagues' dates (the user's
finding, WL:6899–6900; the coordinator's call, accepted):

| Fact | `patch` | `value` change |
|---|---|---|
| `league.dawn-of-the-hunt` | 0.2 | none |
| `league.rise-of-the-abyssal` | 0.3 | none |
| `league.fate-of-the-vaal` | 0.4 | none |
| `league.runes-of-aldur` | 0.5 | `end: "2026-12-11"` |
| `league.forbidden-rites` | 0.5.5 | `end: "2026-12-11"` |
| `league.conquerors-of-wraeclast` (new) | 1.0 | `{name: "Conquerors of Wraeclast", start: "2026-12-11"}` |

- The two new ends and 1.0's start cite a second source, poe2db.tw's homepage league cards, accessed 2026-11-07
  (WL:6883–6886); their notes say an end is the day the league ends, where the older ends are the last day of the
  pricing study's data.
- The conversion facts keep `"0.5.x"`: they come from the study across all five leagues, and `patch` reaches only the
  facts' source tags (`src/plan/referenceData.ts`:240–249), which nothing checks [B §2] (a proceed-on).
- 1.0's `name` is its poe2db section's; the trade site's own name for it is known only at launch, and the fact is
  corrected then by `CLAUDE.md`'s launch note (§4) if it differs (a proceed-on). A market past a league's `end` already
  reads as late (`render-audit.mjs`'s `marketOf`, :238–248; D-373).
- The static test's pins move (`tests/static/buildGuidePipeline.test.ts`:3394–3400).

Amends D-370 and D-373's league table (the data only).

## 11. D-515: search, the runner's Bash, and the agent types

**No search tool** (the user, 2026-11-07, wary of "a quagmire maintaining a new tool just for the sake of purity";
`amendment-16-candidates`; WL:6907–6915). The four agent types keep Read, Glob and Grep and leave out Bash
(`agents/*.md`:4), which in this Claude Code gives them Grep and Glob; R-4, no definition names Bash
(`docs/build-guide/spec/03-pipeline.md`:449), stands. [D]'s sections on a search tool are moot.

**Game knowledge's line** (`skills/game-knowledge/SKILL.md`:16) becomes: search with `grep` through Bash, as the runner
rules allow (`runner-rules.md`:47), and Read a file whole. Its other Grep lines name `grep` the same way. The same holds
for every piece's `SKILL.md`: a runner searches with `grep` through Bash; its agents search with Grep and Glob.

**Each `pob2:` agent type is probed once** for Grep and Glob: the coordinator starts each of the four types with one
task, a Grep for a fixed line of a committed file and a Glob for a committed folder, under a minimal task header (each
definition takes only a runner's task with one, `agents/build-guide-coordinator.md`:3, :13), and records the tool calls
in the work-log (AC-W140). The types must be in the coordinator's session: one the user starts with `--plugin-dir`,
loading the plugin in place, never an install, which would copy `.env` (HG-38). The probe holds up neither milestone's
merge: it runs whenever the user starts that session, and at the latest the WU-168 runs' first `pob2:` calls record it.
**A piece's real cases are asked of a `pob2:` type,** never of a general-purpose agent, which has Bash and so no Grep
(§20).

Amends D-503 and C-58 (game knowledge's Bash line), and a15 §8's "how they're asked" for every later piece.

# Part II. M-30: the pieces

## 12. D-516: piece runs

The substrate every piece run needs (a15 §11 and §18; the user's answer 8 of amendment 15's gap list, "one folder per
use named by the piece, with a run log; never the user's file"; the coordinator's calls, accepted).

- **The folder.** `guide_run {new_run: "<piece>"}`, with the piece `compile`, `pricing` or `writer`, makes
  `Guides/<piece>/<date>-<n>/`, as for any slug (`src/utils/guidesPath.ts`:25, :239–303); no pipeline slug (`open…`,
  `<ascendancy>-…`) collides [B §3]. Its reply gains a line naming the league folder (§19); the log marks the run.
- **The run log** (Appendix A.6). `pob2-run-log <runFolder> init` takes, for a piece run, `piece`, `mode`, `testConfig`,
  `noNinja`, `status` and `source`, no `slug` or `brief`, and writes schema 4 at skill revision 16 (§24) without `slug`,
  `brief`, `dossier` and `builds`. `source` names what the run started from: `{kind: "builds-folder" | "import-code" |
  "run-folder", name?, sha1?, build?}` (`build` a writer's, §18); an import code itself is never written to the log. A piece run logs its steps as the
  pipeline does, under Appendix A.6's step names: `OUTCOMES` (`run-log.mjs`:209–239) gains `read`, `measure`, `place`
  and `price`, and `SCOPES` (:267) `better` and `ladder` for the four D1 steps. Where a pipeline run carries a card id
  (a stage's, checkpoint's and escalation's `concept` and a build's `id`: `CARD_ID`, :188, read at :477, :528–530, :544,
  :566; the checker's `builds[].id`, `check-run.mjs`:2720, and `cards/` layout, :1214–1216), a compile run and a file
  run write `file`.
- **A pricing stop ends the run** (the coordinator's call, accepted; [B], question 4). A piece run has no gate that
  asks to retry: when a step's `priceOutcomes` counts `rate_limited`, `locked_out` or `pace`, `pob2-run-log` appends
  `pricing.stops[]` as today (`run-log.mjs`:277–281, :709–716); the runner asks for the rung if none is placed (§16),
  sets the status to `stopped`, tells the user when the lockout ends, and stops. `/pob2:<piece> --resume <run folder>`
  after that is the retry: a resume clears the stop (D-444, `openStop`, `run-log.mjs`:835), and the step runs again,
  reusing every price the plan holds. No `pricing` answer is logged in a piece run, no retry comes before the lockout
  ends (`CLAUDE.md`), and the checker's `nfr-22` (`check-run.mjs`:2971) stands.
- **The checker: one checker, every rule tagged by its piece** (amendment 15's proceed-on, a15 §18). `check-run.mjs`
  gains a table naming each rule's piece, from [B §4]'s sorting: `run` (layout, run log, display, order, caps, routing,
  design gate, escalation, requests), `game-knowledge` (source tags, offline tag, markers, claim kind), `discovery`,
  `research`, `review`, `compile`, `writer` and `pricing`; a rule two pieces share carries both (`runes`, `corruption`,
  `flasks`: compile and pricing; `known-issues`: writer and review; `test-advice` and the campaign rewards: writer and
  compile). A pipeline run, a log with no `piece` and no brief `from`, is checked by every rule as today; a file run
  (§18) too, `checkFlow4` (:3752) in its own order. A piece run is checked by `run`'s rules as they apply, by game
  knowledge's, and by its piece's; a compile run with a better round by pricing's too. Rule names and messages don't
  change: they are the tests' pins.
- **A piece run's layout:** its files sit at the folder's root, as a schema-3 run's build did (`BUILD_TOP`,
  `check-run.mjs`:1194), with no `builds/`; each piece's known files are Appendix A.6's. For a piece run the checker
  skips the slug-from-brief rule (:2847–2849), the pipeline's lists and `checkFlow4`, but for a compile run with a
  better round, which keeps `checkFlow4`'s D1-loop order (D1-build to F1). `pob2-render-audit` and `pob2-render-notes`
  take a piece run's root build without `--build`, as for schema 3, and `pob2-run-log <runFolder> display design` serves
  a compile run's better round (`DISPLAYS`, `run-log.mjs`:2932).
- **Each piece's `SKILL.md`** is fewer than 150 lines (D-505); its frontmatter holds `name` and `description` only, at
  most 1,536 characters, what Claude Code keeps (a15 §3); its runner reads `runner-rules.md` whole first and after a
  compaction (D-501); its description names when to use it and when another pob2 command is the one, and game
  knowledge's gains the three new commands (a15 §8's rule). Every rule in `runner-rules.md` applies to a piece's runner,
  "write only inside the run folder" meaning its own. M-30's load check records the always-on cost against R-115's.
- **The compaction reminder** (`scripts/compact-reminder.sh`, D-420) ends "If no /pob2:build-guide run is in progress,
  ignore this", though `/pob2:compile` gains a design gate (§17). It is reworded for any pob2 run with a `run-log.json`
  in progress, telling the runner to re-read that command's `SKILL.md` and `runner-rules.md`; build-guide's `SKILL.md`
  keeps the same lines, and `tests/static/runSettingsExample.test.ts`'s sentences (:183–195) follow.

New contract C-61 (§22). Amends C-34 (the folder per piece), the run log's schema 4 (D-412: a piece run's fields), D-444
(a piece run's stop and retry), D-420 (the reminder's wording), the checker's run-log and layout checks.

## 13. D-517: the file reader, `plan_from_build`

**Granted** (HG-12, the user's answer 3): one new server tool, which reads a PoB file, named from the builds folder or
given as an import code, into a plan in the run's own folder, and never writes the user's file. The runner calls it (as
`guide_run` is called, `skills/build-guide/SKILL.md`:34–40), never an agent, so no tool set (`03-pipeline.md`:409–425)
changes, and R-4 stands. Engine kind `none`, group `core`; the count goes from 85 to 86 (84 to 85 with poe.ninja off; 78
to 79 with trade and poe.ninja off). The name is a proceed-on (§30). Contract C-62 (§22, Appendix A.7).

**Engine-free parsing, not a load** (the drafter's call, which the handoff left to it; [A], question 1). The reader
extends read-back's parser, `parsePobXml` (`src/services/readBack.ts`:110–188), and reads the file as written: every
item, including one on a base the pin lacks, which a load drops without a word (PG-110,
`Classes/ItemsTab.lua`:1133–1140); every gem of a granted group, which a load drops (D-398); each roll from the item's
text, never PoB's misnumbered `<ModRange>` copy (PG-109), but an item with no `{range:` tag reads its `<ModRange>`, as
the load side does (§7). The parser gains what it reads none of (`readBack.ts`:27–79): the `<Build>`'s class,
ascendancy, level and `mainSocketGroup`; the active sets; `<Import>`; each `<Spec>`'s `treeVersion` and weapon-set node
tags; a group's `source`, `slot`, `mainActiveSkill` and `groupCount`; a gem's `count` and `corruptLevel`; each item's
`<ModRange>`; `useSecondWeaponSet`, true only for `"true"`, as PoB reads it (`Classes/ItemsTab.lua`:1153;
CullTheConquerer's file writes `"nil"`). It holds no engine lock. Node names come from the tree service, as read-back's
do (`src/handlers/planHandlers.ts`:298–328); base names from the pin's `Data/Bases/*.lua` as text [C §2], matched as PoB
matches them (`Classes/Item.lua`:781–818): exact, then for a normal or magic item the longest base name its name holds
(a magic flask's name carries its affixes), then Two-Toned Boots, then a `Superior ` strip. **Rejected:** a load through
the engine, which loses the first two, moves the third unless patched (§7), replaces the loaded build and gives back
only what PoB keeps.

**The tree version.** A `<Spec>`'s `treeVersion` the pin lacks is refused, naming it: nothing can measure it (a 1.0
import before our pin upgrade). An older one the pin holds (`0_1` to `0_5`, `GameVersions.lua`:10) is a question: read
it onto the pin's newest tree, the nodes that tree lacks listed in `left`, or stop. Nodes are never named from a
fallback tree: the tree service falls back to its newest (`src/services/treeService.ts`:87–90) and names a node it lacks
by its id (`planHandlers.ts`:322–325), and the compile builds on the newest (`pob-api/API/Compile.lua`:1494). The
`<Build>`'s `targetVersion`, `0_1` in every import (PoB's `liveTargetVersion`, `GameVersions.lua`:5), is ignored.

**Two calls** (the coordinator's resolution of the review; Appendix A.7). The first takes `run_folder`, a folder under
the guides root holding a `run-log.json`, resolved and confined as `guide_run`'s paths are (`resolveInGuidesRoot`,
`src/utils/guidesPath.ts`:115), and either `build_name`, a builds-folder file resolved as the other build-file tools
resolve names, read only, or `import_code`, decoded under D-50's 16 MiB cap (`src/utils/buildCode.ts`). It fetches
nothing. It keeps the decoded document in the run folder as `source.xml`, its sha1 in `read.json` (answer 3's "never
writing the user's file" allows a copy in the run's own folder), and writes `plan.json` (schema 11, Appendix A.5) and
`read.json`. The second call takes `run_folder` and the answers only, reads `source.xml`, re-reads a builds-folder
source and refuses a changed sha1, and refuses to replace a `plan.json` a design step wrote (the log holds a D1 entry).
So a code goes to the reader once, on the first call (ResurrectForbidden's is about 13,500 characters), and a compaction
loses nothing; nothing goes in the builds folder.

**One loadout, one stage** ([A], question 3; for an import, the active loadout). The file's active loadout (PoB's active
spec, item set, skill set and config set) by default, or the one `loadout` names by its title, paired by PoB's rule as
read-back pairs them (`readBack.ts`:5–10); a title that doesn't pair is refused, with the file's loadouts listed.
`read.json` lists every loadout the file holds. A guide author's file of several loadouts is read one loadout at a time
(a proceed-on).

**The read stage** (Appendix A.5): id `f`, `progress: "endgame"`, no variant, as a card's skeleton is a one-stage
endgame plan (`skills/build-guide/references/stages/R1b.md`:183–186); its `level` the file's build level; its
`loadoutName` "<the loadout's title> (L<level>) {f}", a trailing ` (L<n>) {…}` stripped from the title first (our
server's files title their specs so, `readBack.ts`:5–6, and the schema refuses braces before the suffix,
`src/plan/schema.ts`:614–622); `source` `{kind, name, sha1, loadout}`. Placing it (§16) gives it its rung's id and
variant fields; a character below the endgame isn't placed (choice A).

**What it reads, and how each PoB gap is handled:**
- **The tree:** nodes split into `nodes` and `ascendancyNodes` by the tree data; weapon-set tags into
  `weaponSetNodes`; attribute overrides into `attributeChoices`; socketed jewels into `treeJewels`, owned.
- **Items, as owned** (the coordinator's call, accepted; the user's "won't reject a build that works in-game"): each
  slot's item text whole, its rarity, name, base, `Implicits:` line, crafted, fractured, desecrated, enchanted and rune
  lines, sockets, runes, quality and corruption, its rolls from the text; marked `owned: true`; the swap slots read
  (ResurrectForbidden is saved on its swap set, its sceptre giving 115 of its 215 Spirit, a15 §11). Charm slots are read
  and owned: PoB measures them; the pipeline still plans none (charms deferred). A filled slot the plan's slot list
  lacks (`Arm`, `Leg`, an item's jewel sockets, `Classes/ItemsTab.lua`:32) goes to `left` with its reason.
- **PG-110, an item on a base the pin lacks:** left out of its slot, its text in `read.json`'s `left` with the reason,
  and a question: what the slot should hold. A `stand_in` answer (an item text the user gives, or the user's yes to
  typing it on the plain base, PG-110's workaround) goes into the slot marked `standIn: true`. Never dropped silently.
  A gem or support the pin lacks goes to `left` the same way, with a question.
- **PG-111, a base name the data defines twice:** the item keeps its `Implicits:` line, so the compile never refills it
  (D-435 fills only a text with none); a text on one of those 19 bases with no `Implicits:` line is named in
  `read.json`. The names come from the pin's data, the bases defined more than once.
- **Legacy and unobtainable content** (D-384): an owned legacy gem or a unique PoB says is no longer obtainable is read,
  kept owned and named in `read.json`; the compile measures it rather than refusing it (§15), since the character has
  it. A design never adds one (D-395), and a guide never keeps one (§15).
- **PG-108, the duplicates:** PoB's own granted groups (with a `source`) aren't written; the compile rebuilds them
  (D-382, `pob-api/API/Compile.lua`:1782–1798). A plain group whose first active gem a stage's item or passive grants is
  a copy. Per granted skill the plan keeps the copy with the most enabled supports (the first on a tie), its supports
  with it [A §4]; one with no support is dropped when its level equals PoB's group's, and kept, both levels in
  `read.json`, when it differs (the importer defaults a level to 20, `ImportTab.lua`:990, :1042–1046). A granted group
  holding supports added in desktop PoB (which the pin's load drops, D-398) becomes the kept copy when no plain copy has
  more. The kept copy takes its granting item's weapon set (2 for a Swap slot, both when both sets' items grant it),
  since an import's plain groups carry no `slot`. `read.json` lists the drops (the rules a proceed-on). PoB applies a
  buff of one name once, at the higher values (`mergeBuff`, `Modules/CalcPerform.lua`:41–62).
- **PG-114, granted quality:** a plain copy's quality goes into `skills.granted` only when above 0: an import's 0 can't
  be told from "the game sent no quality" (§8), so it counts as unknown and the bridge's rule applies.
- **Groups:** `weaponSet` from the group's slot (`Weapon 1` and `Weapon 2` give 1, the Swap slots 2); `set1` and `set2`
  attributes, which the pin neither reads nor writes, ignored [A §4]; levels, quality and `enabled` as written; `role`,
  required (`src/plan/schema.ts`:432), `single_target` for the main group and `utility` for the rest until the measure
  or the user says otherwise (the clear measure falls back to the main group, `src/plan/record.ts`:785–796); `count`
  from `groupCount`, `countReason: "from the file"`; a `corruptLevel` of +1 as `corrupt: "plus_one_level"`, any other
  kept as the level and named; owned. Answers name groups by plan number; a question shows the file's beside it, and
  `read.json` keeps the map (ResurrectForbidden's `mainSocketGroup` 14 is plan group 11 once its copies drop).
- **PG-113, the main skill:** a question, listing each enabled group's active skills (a group of two, such as
  CullTheConquerer's Blasphemy group, by its `mainActiveSkill`), the file's `mainSocketGroup` marked as PoB's choice,
  possibly its guess, and named so when it points to a dropped or granted group. Until it's answered, the file's value
  stands in `skills.main` and `rolledGroup`, marked unconfirmed in `read.json`.
- **PG-107, the buffs:** the reader can't reckon the Spirit without the engine; the measure asks (§15), and its answer
  comes back as `buffs_on` (kept on) and `buffs_swap` (moved to the other weapon set, as `weaponSet`): the others become
  switched as needed (§14).
- **The configuration** (the user's answer 4, "Keep as set, but call out anything that seems wrong to the user"): the
  loadout's config set is written as `config.file`, each PoB input by name and value, custom modifiers among them.
  `config.earned` is empty; `config.scenario` holds only `enemyIsBoss`, which the schema requires (`schema.ts`:527–529),
  at the file's value, its source `{file: "source.xml", key: "enemyIsBoss"}` with a `judgment` tag. The compile writes
  them as set, and the measure calls out what seems wrong (§15); nothing changes without the user's word.
- **The roll and the league:** `roll.className`, `roll.ascendancy` and `roll.skill` (the main group's active skill)
  from the file. The plan's `league` is null (allowed without prices, `schema.ts`:790); `read.json`'s `importLeague`
  holds `<Import lastLeague>` when the file has one (PoB's importer writes it, `ImportTab.lua`:398–406; poe.ninja's
  export doesn't). The step that prices sets the league (§16).
- **Not read:** notes, PoB's computed `<PlayerStat>`s (the compile recomputes them), the import's character hash, trade
  weights, timeless data, the party tab; `read.json` says so, and the measure calls out a filled party tab.

**What it refuses** (an `isError`, nothing written): a document that isn't `<PathOfBuilding2>`; a tree version the pin
lacks; a `build_name` that isn't a file of the builds folder; a code that doesn't decode or inflates past 16 MiB; a run
folder outside the guides root or without `run-log.json`; on the first call, both or neither of `build_name` and
`import_code`; on the second, either of them, a changed builds-folder file, or a plan a design step wrote; an answer
naming a group, loadout or slot the file lacks.

Amends C-1 (86 tools), HG-12 (this tool, granted), C-31 (schema 11's read fields).

## 14. D-518: Spirit buffs switched as needed

The user's answer 5 took the recommendation: the buff is in the plan and the guide, off in the measured numbers; the
guide says when to switch it on and what to switch off for it; V1's Spirit check counts only the buffs on together.
Weapon-set toggling works today and doesn't change (D-426).

- **The plan** (schema 11, Appendix A.5): a group's `switch: {when, off}`. `when` is a short player-facing phrase, when
  to switch it on ("for bosses", "as needed"); `off` lists the plan's group numbers switched off for it. A group with
  `switch` has `enabled: false`: the compile writes it disabled, so its reservation and effect stay out of the measured
  numbers, and marks it on PoB's group, so the recount counts its slot (§6). Schema 11's `switch` is WU-160's, beside
  the reader that writes it.
- **Each switch is measured** once more, with that group on and its `off` groups off, and restored after, as the boss
  pass restores what it set (D-437). The record gains, per stage, `switches: [{group, off, spiritUnreserved,
  keyFigures}]` (Appendix A.8).
- **V1** keeps PoB's Spirit warning on the measured loadout, so the buffs on together are what it counts, and gains
  `switched-spirit`: a switch whose measure leaves unreserved Spirit below 0, naming the group and its `off` list. On a
  stage that uses weapon set 2, a switch is measured on the set the plan measures (a proceed-on).
- **The designers** (D1-build, D1-finish) may keep a buff the Spirit can't carry with the rest as switched, with `when`
  and `off`, instead of cutting it (the user, 2026-11-06: "We'll need the designers to be able to support that use
  case").
- **The guide:** W1 writes one line per switched buff in the skills section, "<skill>: switch it on <when>; switch
  <skills> off for it." The endgame template's "short on spirit" line (`guide-endgame-template.md`:120) points to these
  lines. The checker's writer rule `switched-buffs` finds a line per switched group (a proceed-on).
- **An import** (PG-107): the measure lists the buffs over the Spirit (§15), the user says which stay on and which move
  to the other weapon set (the user's "toggle them with weapon sets or as needed", `spirit-buffs-toggled`), and the
  reader writes the rest switched, `when: "as needed"`, `off` as the user confirms it.

Amends D-426 (V1's Spirit reading), C-31, C-33, C-41, the W1 templates.

## 15. D-519: compile as a piece, `/pob2:compile`

**What it does:** on a PoB file, a builds-folder name or an import code, it reads the file into a plan (§13), measures
it, shows the user what it measured and what seems wrong, and, on request, runs the better round (§17). It is use (a)
of the user's answer 2, "(a) first": the player's imported character, read into a plan as owned, measured and priced,
with pricing (§16). Contract C-63 (§22).

| Step | Who | Writes | Does |
|---|---|---|---|
| 1. Start | runner | `run-log.json` | `guide_run {new_run: "compile"}`; `init` with `piece: "compile"` |
| 2. `read` | runner | `source.xml`, `plan.json`, `read.json` | `plan_from_build`; its questions asked as an interview (the main skill, a stand-in for an unknown base, the loadout when the file holds several, an older tree); the second call with the answers |
| 3. `measure` | `pob2:build-guide-coordinator`, fresh, `skills/compile/references/stages/measure.md` | `measure.md`, the compile record and `compiled-build.xml` beside the plan | below |
| 4. The display | runner | — | short and player-facing: the measured file first (`compiled-build.xml`, to open in PoB), the headline figures, each target's distance, endgame or campaign (choice A) for the owner to correct, the callouts, the Spirit question; an answer that changes the plan runs steps 2 and 3 again |
| 5. Better, on request | §17 | | the better round |
| 6. End | runner | — | `pob2-check-run <runFolder>`; status `completed` |

**The measure step** (a coordinator step, since only the coordinator compiles, D-130):
- **The engagement distance** the toughness band needs (`skills.engagement`), taken from the main skill as D1-build
  takes it (a proceed-on; a15 §11 left it open for review).
- **A measure-only compile** of the read stage under its own configuration (`compile_plan {plan_path, measure_only:
  true, measure_as: "non-budget"}`), into the run folder only. `measure_as`, new, runs on every read stage (the
  coordinator's resolution of the review) the passes an `n` stage gets, each keyed on a variant today
  (`src/plan/compiler.ts`:1121–1138, `src/plan/record.ts`:1238): the boss pass, the resisting and Arbiter reads, and a
  toughness read at `n`'s reference hits, each restoring the file's configuration after (as D-437's boss pass does).
  The stage gets no variant, so V1's rung rules don't apply.
- **The Spirit question:** when unreserved Spirit is below 0 on the measured set, the buffs and each one's reservation,
  with a proposed `off` list per buff the user might switch (the fewest buffs on whose reservation makes room), and the
  option to move a buff to the other weapon set, for the runner to ask (§13, §14).
- **The callouts** (the user's answer 4): every configuration input that seems wrong, each with why, none changed: (a)
  a state nothing in the build produces (V2's check); (b) a custom modifier line and (c) an enemy setting other than
  PoB's default (boss tier, level, resistances, armour, evasion), each only when the coordinator judges it wrong, such
  as a custom line no item or node explains, the rest listed in `measure.md` and not in the display; (d) a filled party
  tab; (e) a condition or charge count held up that the build's producers can't keep up, with its reason; (f) anything
  else that seems wrong to the coordinator, with its reason. (a) and (d) are mechanical, the rest judgment (the
  categories a proceed-on, §30).
- **The summary against `n`'s targets,** the only rung that has them (`toughness-targets.json`, `boss-floor.json`):
  the toughness band with the lowest max hit and its type beside it (`toughness-reads-ehp-and-max-hit`), the boss floor,
  the one-shot floor (80% of the Arbiter's hits survived), clear speed, each with its distance, shown as where the
  character is headed, never as failures (a15 §11's suggestion, a proceed-on). The stage is judged against them only at
  the endgame; below it, choice A decides. Uncapped resistances are stated as facts.
- **The file card,** `cards/file.md`, when a design round follows (§17, §18): the card format's brainstorm half,
  written from the read plan, the measure and the user's words (name, chain, means, enabler, the defence line, how it
  clears, traps), with no verification half. It is the minimum a step that reads a card needs when there was no
  brainstorm ([A], question 8), so D1, D2 and W1 run on a file unchanged (a proceed-on).

**The compile on a read plan** (C-41's changes):
- `config.file` is written as set: the compiler neither overrides one of its inputs nor fills reference hits on its
  stage (`withReferenceHits`, `compiler.ts`:756–779, gives a skeleton `b`'s today); V2's findings on it are callouts
  (finding kind `from-file`), never a failed verdict.
- **Owned content, while a character is measured and priced** (compile, pricing, and `/pob2:compile`'s better round),
  passes the rules that would reject what the game allows (the user, 2026-11-06): an owned item, group or tree jewel is
  exempt from V1's `sockets`, `affix-cap`, `corruption` and `movement-tier` (`src/plan/checks/v1.ts`:961–967), from the
  compile check's refusal of legacy content (D-384), from D-465's rule on Legacy soul cores and the Raven-Touched Shard,
  and from the checker's `rare-title`, its item `corruption` (`check-run.mjs`:6373), both parts of `flasks` (the charm
  slots and the Life Flask in Flask 1, :6498, :6502) and pricing's `spec` and `listing` rules. It is measured as any
  item is, and the record marks it (`owned` per slot). Only the reader marks content owned; a design that replaces an
  item drops the mark, and the replacement meets every rule (a test).
- **In a guide** (a file run's placed rung, or the writer on a compile run's better round, §18), owned content meets
  D-395, D-465 and the corruption rules (D-471, D-484), and its rares become specs (§16).
- A switched group is written off and marked, and each switch measured (§14); `skills.granted` sets quality (§8).

**Its `SKILL.md`** (fewer than 150 lines). When to use it: a player's PoB file or code, "what does my character do",
"measure my build", "make my character better", until amendment 17 gives review "how can I make this build better",
whose findings then point to the better round. When not: a guide from a file (`/pob2:build-guide`, §18); prices
(`/pob2:pricing`); a game question (`/pob2:game-knowledge`); a review of a file, not yet a pob2 skill (amendment 17).
It never writes the user's file, and prices only in `place` and the better round's D1-finish and D1-gate, announced
as the pipeline's pricing is.

Amends C-41 (the read plan's compile, `measure_as`), C-58 (game knowledge's description gains the command), D-130's
step list (the coordinator's step table gains `measure`).

## 16. D-520: pricing as a piece, `/pob2:pricing`

**What it does** (the user's answer 6, "both", and answer 2): on a PoB file it reports what the gear costs to replace,
the cheapest way to the same must-have stats; places the character on the ladder by that price; and, with a budget the
user names, the upgrades within it. Contract C-64 (§22).

| Step | Who | Writes | Does |
|---|---|---|---|
| 1. Start | runner | `run-log.json` | `guide_run {new_run: "pricing"}`; `init` with `piece: "pricing"`; the budget asked |
| 2. `read` | runner | `source.xml`, `plan.json`, `read.json` | as compile's step 2 |
| 3. The notice | runner | — | before any trade request: that pricing starts, about how many searches, at least 45 s apart, and that the browser shares the limit (`runner-rules.md`'s trade rules); over 30 searches, the user's yes first (`CLAUDE.md`'s 30 without asking) |
| 4. `price` | `pob2:build-guide-coordinator`, fresh, `skills/pricing/references/stages/price.md` | `plan.json`'s `prices[]` and the rung, `upgrades.json`, `prices.md` | a measure-only compile first, since `find_upgrades` and `manage_sets` act on the loaded build (`src/handlers/tradeHandlers.ts`:689–716, `setHandlers.ts`); then the league and the parts below |
| 5. The display | runner | — | short: the replace cost by slot and in all, the place, each slot's upgrades with gains, prices and links, for the user to pick |
| 6. End | runner | — | `pob2-check-run`; `completed`, or `stopped` (§12) |

**The league** (the user's rule: "no trade between leagues", `current-league-default`): the file's `importLeague` when
trade lists it (`get_leagues`); otherwise, or when it is Standard, hardcore, SSF or ended, the runner asks before any
search. Trade's league (D-20) stays for designs.

**The replace cost.** Every filled slot and tree jewel, priced the cheapest way to the same must-have stats:
- a rare item or rare tree jewel by its spec from the owned rare (below), at the spec loop's depth price (`pricing.md`,
  D-483);
- a unique by its name; a corrupted one as the corruption rule says: a cheap unique priced uncorrupted, a dear one's
  extra socket priced as that corrupted copy when it's in budget (`corruption-cheap-uniques-and-gems`, D-471);
- runes, soul cores, uncut gems and currency from poe.ninja's exchange (`get_item_price`); flasks unpriced (D-472);
  charms unpriced (charms deferred);
- a total, by slot.

**A rare's spec from an owned rare** (the coordinator's call "a guide's rares as must-have stats", accepted; also used
by a guide from a file, §18): its must-haves are the three or four affix lines it carries that rank highest in PoB's
weights for the slot (`find_upgrades {link_only: true}` gives PoB's top 12 affixes with no request, D-483), the spec
loop's count (`pricing.md`'s spec loop); each required at the lowest roll of the tier its value falls in (the lookup's
tier ranges, D-485); a fractured line searched as a plain explicit mod (the user's rule, `price-fractured-as-plain`); a
crafted or desecrated line searched by its text as an explicit mod; a corrupted implicit left out (corruption never on
rares); the item level the item's own, at most 82. The last three are proceed-ons (§30). The checker's pricing rule
`owned-spec` checks each spec against the owned item's lines.

**The place** (answer 2: "The pricing stage should determine that, or the user can say the rung if trade is
unavailable"), by the replace cost against `pricing.md`'s targets (D-371): `m` when the whole cost is within `m`'s 5
divines; else `b` when no rare's or rare jewel's cost is over about 5 divines (its converted depth price's midpoint at
most 5) and, by choice B, no unique's is either (uniques have no target of their own, `pricing.md`:145); else `n`, said
to be over 200 divines when it is (the reading of "about" a proceed-on). A character below the endgame isn't placed
(choice A): its place is "in the campaign". Without trade (trade off, or a stop before the rung is known) or under
`--no-ninja` (no rates, `pricing.md`:263–264), the runner asks the user for the rung; a missing cookie isn't "without
trade", since depth checks search anonymously (`pricing.md`:34, :261–262). Never assumed `n`. The read stage takes its
rung's id, `variant`, `ascendancyPoints` (from the file's ascendancy nodes) and `variantBasis`; the checker's
`placement` rule recomputes the rung from `prices[]`. This placement scope of `price.md` (the league, the cost, the
rung) also serves compile's better round (§17) and a file run (§18).

**Upgrades within the user's budget.** For each gear slot, one `find_upgrades` call (PoB's weighted search, at most two
searches a call under D-461's pace) with the price capped at the budget; each listing with PoB's gain (Full DPS, EHP,
the lowest max hit) and its price. The display lists them by slot and the user picks, since three unlike gains have no
exchange rate to rank them (`targets-not-vetoes`). Upgrades are listings, each with its trade link: they improve this
character, where a guide names specs (`guide-items-are-specs`: "Optimising to specific listings belongs to optimising a
character"). With no budget named, no upgrade search runs; without a cookie, each slot gets `find_upgrades`' link alone
(`src/server/toolSchemas.ts`:1564).

**The searches.** About one depth check per rare and jewel and one `find_upgrades` call per gear slot: for ten rares,
about 30 searches, some 25 minutes at the server's pace; the notice asks first above 30. A stop ends the run `stopped`
(§12): the runner asks for the rung if none is placed, and `/pob2:pricing --resume <run folder>` after the lockout is
the retry, reusing every price the plan holds, and may place again.

**Where pricing lives in `/pob2:build-guide`** ([B], question 8; the drafter's call, recorded): `pricing.md` moves to
`skills/pricing/references/pricing.md`; the pipeline's five pricing steps (R1b, D1-build, D1-finish, D1-gate, D2) keep
pricing inline and read it there, by the new path. Rejected: a pricing step of its own in the pipeline, which would
split D1-build's spec loop (it measures as it prices) and change the flow `checkFlow4` checks.

**Its `SKILL.md`** (fewer than 150 lines). When: what my gear costs; which rung my character is on; what to buy for N
divines. When not: a game question; a guide (`/pob2:build-guide`); measuring or improving (`/pob2:compile`).

Amends D-178 (a piece run that prices, through the coordinator only), D-371's table (also placing a file), C-14's use
(capped at the user's budget; the tool is unchanged).

## 17. D-521: make my character better, the better round

**New, from the user** (answer 2, quoted in §1: "run a design round on it first … then build the guide from that"). A
design round on a read plan toward the pipeline's targets (the toughness band, the boss and one-shot floors, clear
speed), within the user's budget, shown at a gate as the pipeline's gates are: an interview with a pitch, a PoB file,
the trades shown, targets and not vetoes (`gate-ux-over-testability`, `pob-file-over-chat`, `targets-not-vetoes`). It
runs in `/pob2:compile` when the user asks (in the request, or after the measure), and in a file run before the ladder
when the user wants both (§18). Amendment 17's review names it as a finding's next step.

**What it needs:** a measured read plan (§15) with its file card; the place, from pricing's placement scope (§16, run
by its reference's path) or, when trade is unavailable, named by the user; and the user's budget, asked by the runner.
Without trade, the round designs at the floor tiers, its prices `unavailable` (A-72's rule), and says so once. For a
character below the endgame (choice A), the round aims at `m`'s targets, its survival floor and damage rule (D-281),
within the budget.

**How it reuses D1's stages.** The four design steps run on the read stage with `scope: "better"` in the task header,
each stage reference gaining one short section for it:
- **D1-build** starts from the read stage where it starts from a card's skeleton today (`D1-build.md`:80–83) and
  changes it toward the targets within the budget; it designs no other rung.
- **D1-tree** searches from the character's own tree: players respec freely, one start node the only constraint
  (D-452; the user's ruling, 2026-10-26).
- **D1-finish** prices each replacement by the spec loop, and writes the anoint, the ledger and the claims, and
  `trades.json` (each change a trade).
- **D1-gate** judges the result as it judges a rung, except that a target the budget can't reach is a finding shown at
  the gate with what it would cost, not a failed attempt; in the `better` and `ladder` scopes the checker accepts a
  missed target only as such a finding (its part rule, `check-run.mjs`:2015–2016). The legality parts (compiled, V1,
  V2) fail as today. On a pass it writes the draft PoB file into the builds folder (D-466) by `draft_name`, named after
  the source and "better", under that option's collision rule (`src/server/toolSchemas.ts`:1097), never the user's
  file's name (a proceed-on on the name).
- **The design gate** is the pipeline's (D-367's display, the interview): the draft's name first, the pitch, the
  headline changes, each change with what it gains and costs. Accept runs F1, which writes the final PoB file by
  `first_free` (:1093), under its own name; revise runs D1 again; stop ends the run.

**What it may change:** the passive tree's points; supports and gem levels; any slot's gear within the budget; the
anoint; a buff switched as needed. **What it keeps unless the user asks** (proceed-ons, §30): the class, the ascendancy
and its allocated ascendancy nodes; the main skill and the weapon type it needs; the character's level; the
configuration as set; each owned item, unless replacing it gains within the budget, and then the replacement is a trade
the gate shows. A changed item is a design: it loses the owned mark and meets every spec rule (§15).

**What it writes:** the round's plan and record in the run folder, `trades.json`, the gate's verdict, the draft and then
the final PoB file in the builds folder. A guide comes only from a file run or the writer (§18), under a guide's rules
on owned content (§15).

Amends D1-build's, D1-tree's, D1-finish's and D1-gate's stage references (a section each), C-36 (the task header's
`scope: "better"`), C-63.

## 18. D-522: a guide from a file, and the writer

**Where it starts** (the user's answer 2 (b); where it is invoked is choice F, §30): recommended, `/pob2:build-guide`
from a file. The brief gains `from`, a builds-folder name or `"import code"` (the code itself goes only to the reader;
C-51, Appendix A.6), and the run's slug is `file`. A guide from a file runs the pipeline's own steps from the design on
(D1, the design gate, F1, D2, W1, V4, the fix round, the final gate), its gates and its run log, so it is
`/pob2:build-guide`'s order of calls with the compile piece's steps in front, and the compile piece's `SKILL.md` stays
small. The alternative, `/pob2:compile <file> guide`, puts the pipeline's back half into a piece's runner.

**The steps added before step 6a** (the rest as the pipeline's):
1. `read` and `measure`, as compile's (§15); the measure writes the file card and its dossier row, so D1, D2 and W1
   read what they read today.
2. `place`: pricing's placement scope (§16) with trade; the user's word without it. The file is never assumed the top
   rung (answer 2). A file below the endgame has no placed rung (choice A): the ladder's three rungs are all designed,
   seeded from it (a proceed-on).
3. With "better" wanted (the brief's `better: true`, or the user's word at the start): the better round (§17) to its
   design gate; its accepted result is placed again from the plan's `prices[]` (few or no new searches, by the reuse
   rule; the user names the rung only without trade), and the ladder is built around that rung (answer 2: "run a design
   round on it first, … then build the guide from that").
4. **The ladder:** D1-build in a `ladder` scope designs the other rungs around the placed one, above and below (the
   coordinator's call). The placed rung keeps the file's design (or the better round's), changed only on the user's
   request (a15 §11, D-506), with its rares turned into specs by the rule of §16, so any player can buy them
   (`guide-items-are-specs`); its uniques stay named. Owned content a guide can't carry (D-395, D-465, D-484) is shown
   at the design gate as a trade, with what replaces it (§15). A rung below takes the placed rung's skill and
   supports with cheaper gear meeting its own target (D-281's rule for `m`, applied to each rung below); a rung above
   takes the placed rung as its seed and upgrades within its target (D1-build's seeding, `D1-build.md`:186–205).
   D1-tree runs on the designed rungs only; the placed rung's tree is kept. D1-gate judges the designed rungs as today
   and reports the placed rung's floor, tree and budget parts as findings, never failing it for them (a proceed-on).
5. Then step 6c's D1-finish onward: the design gate, F1, the campaign by D2 (the approved roadmap's "the cheaper rungs
   and the campaign added", a15 §11, D-506; declinable at the start, a proceed-on), the D2 gate, W1, V4, the fix round,
   the re-check, known issues, the checker and the final gate.

R1a, R1b and the verification gate don't run in a file run: the file is the skeleton, and its card is the file card.
`checkFlow4` checks a file run (slug `file`) in its own order: `read`, `measure`, `place`, the better round's steps when
it ran, then D1 onward as the pipeline's. The run's one build is `builds/file/` (D-412's layout), its card
`cards/file.md`; `pob2-render-audit`, `pob2-run-log`'s displays and the checker accept the build id `file` beside the
card ids (`render-audit.mjs`:826; §12).

**The writer, `/pob2:writer`** (C-65). It writes a guide for a build that passed F1, in a run folder the user names (a
build-guide run's build, a file run's, or a compile run whose better round was accepted), into its own piece run folder,
`Guides/writer/<date>-<n>/` (§12):
- its log's `source` is `{kind: "run-folder", name: <the folder, relative to the guides root>, build?}`;
- W1 runs as the pipeline runs it, its task header gaining `source`, the folder it reads the plan, the record, the card,
  the D1-gate verdict, `trades.json` and `trade-links.json` from; it writes `guide.md` and `audit.md`'s known issues in
  its own folder;
- `pob2-render-audit <runFolder> --source <folder> [--build <id>]` and `pob2-render-notes` the same way read the source
  and write into the writer's folder;
- the checker checks its guide and audit against the source's files, with the writer's rules (§12);
- **the minimum it needs without a brainstorm** ([A], question 8): the file card (§15), the final record, a D1-gate
  verdict and the claims. A compile run with only a measure has none of the last two, and `pob2-run-log init` refuses
  it as a writer run's source, naming the better round or a file run. A better round's build gets the endgame template,
  for its one rung, its owned rares written as specs (§16); a source keeping content a guide can't carry (D-395, D-465,
  D-484) is refused, naming it and pointing to a file run (a proceed-on).
- Its `SKILL.md` (fewer than 150 lines): when (a guide for a finished build, a rewrite after the user's edits), when not
  (a guide from a file: `/pob2:build-guide`).

Amends C-51 (the brief's `from` and `better`, the slug `file`), C-36 (the task header's `scope: "ladder"` and
`source`), D-104 and D-281 (rungs designed around a placed one), W1's inputs, `render-audit.mjs` and
`render-notes.mjs` (`--source`), D-503's description of `/pob2:build-guide` (it starts from a brief or a PoB file).

## 19. D-523: new items on the user's side

**Kept, last in M-30** (the user's answer 9, "keep it"; `pob-league-launch-gap`). In a new league's first days PoB2 and
our pin lag its items; the overlay lets the server measure the league's new socketables, and uniques on bases the pin
knows, before our pin upgrade, from a digest fetched on the user's side.

- **When:** at a pipeline or piece run's start, online and not under `--test` (offline mode's "no web",
  `skills/build-guide/references/offline-and-test.md`:9–12), the runner runs `pob2-league-digest --running --out
  <league folder>`, a new `bin/` command (C-57 gains a fifth, its rule in the run settings example and
  `runner-rules.md`'s Bash list). When no running digest exists, or the newest records no end (a digest made before its
  end was announced keeps counting after the next league starts), it reads poe2db's homepage cards, at most once a UTC
  day, kept in the league folder, and runs `league-digest.mjs` for each running league with no digest, at D-497's pace
  (serial, at least 3 s apart, no cookie, one retry after 60 s on a 429 or 5xx, nothing fetched twice). The runner names
  any running league still without one, once. Offline, nothing is fetched, and it says the new league's items aren't in
  the committed data.
- **The league folder,** `<stateDir>/league/` (C-16), is named in `guide_run {new_run}`'s reply, and the runner passes
  it to the command's `--out` (`league-digest.mjs`:792) and to `pob2-run-log init`: resolving it in Bash could split it
  from the server's, whose `XDG_STATE_HOME` the registration may set (README.md:91). The command passes `--save <league
  folder>/pages`, so the script makes no temporary folder (:746) and writes nothing outside the league folder, which
  `runner-rules.md`'s "Where you write" names for it.
- **Where it lives** (the drafter's call, recorded; [C], question 6): the state folder, which an update doesn't replace,
  until amendment 18 moves the server into the plugin; then `${CLAUDE_PLUGIN_DATA}`, which neither Bash nor the user's
  own server registration sees today (a15 §11), becomes the candidate.
- **The sidecar** ([C], question 8): `league-digest.mjs` writes `<slug>.overlay.json` beside every digest it writes,
  committed or not, from the parsed page lines (their implicit flag and line classes), not from the Markdown, which
  loses them [C §2] (Appendix A.11). A socketable entry: name; `type` (`Rune`, `SoulCore`, …, from the poe2db tag);
  level as PoB's `rank = {n}`; socket-bound; and per slot the PoB slot keys and lines, each with a `statOrder` (an
  in-pin line's number when the stripped text matches, else a fresh one above the pin's largest, so unrelated lines
  never merge, `Classes/Item.lua`:1648–1649). PoB reads `"Socketed" .. type .. "Effect"` on every item of the slot type
  (:1170–1173), `rank[1]` and `statOrder[1]` (:1262–1265, `Classes/ItemsTab.lua`:1952), so an entry without them breaks
  every such item (PoB's own, `Data/ModRunes.lua`:2823–2843). A unique entry: name, base, level requirement, implicit
  count and lines, explicit lines with PoB's `(a-b)` ranges. Slot labels map to PoB's keys through a committed table,
  `data/league/rune-slots.json`, built from the pinned corpus (the in-pin socketables of `runes-of-aldur.md` against
  `Data/ModRunes.lua`) and checked against it by a test; an entry whose label the table lacks, a unique on a base the
  pin lacks, a gem, an ascendancy and a passive aren't written, and the script lists them.
- **The server** lists the sidecars in Node, since headless PoB can't list a folder (`NewFileSearch` is a stub,
  `HeadlessWrapper.lua`:83, and the runtime ships no `lfs`): every one in `data/league/` and the league folder, a
  committed one replacing a user-side one of the same league ("a committed digest wins"). It passes their absolute paths
  in a named child variable set from its deps (the Lua client gets no `stateDir` today, `src/pobLuaBridge.ts`:258–264).
  Bootstrap step 5e (after the patches, §5), in a `pcall`, reads only those files: a socketable into
  `data.itemMods.Runes[<name>][<slot key>]`, which PoB reads live (`Classes/Item.lua`:1050, :1615–1672), and into the
  items tab's rune list, a file-local PoB builds once (`Classes/ItemsTab.lua`:1948–1963), reached through
  `debug.getupvalue` on `GetValidRunesForItem`; failing that, logged, the trade rune list lacks them; a unique as raw
  text into `data.uniques[<type>]` and `main.uniqueDB.list`, built as PoB builds its own (`Modules/Main.lua`:148–189) [C
  §3]. **Before a load or a compile** the server compares the sidecar set (names and modification times) with the one it
  loaded, and step 5e runs again for new entries: the engine stays up between calls (`src/engine/session.ts`:464–468),
  and the runner can't restart it (no `lua_stop` among its tools, `skills/build-guide/SKILL.md`:34–40).
- **Retirement:** an entry whose name the pin already defines is skipped at load and logged; `--reflag` (and the upgrade
  script, §4) flips the digest's flag and reports the overlay entries that retired.
- **Marks:** a stage that holds an overlay item has the record's `overlay: [<names>]`; the guide, the audit and every
  gate display say "measured with <name>'s lines from poe2db, not in PoB's release" (a proceed-on wording). A card or
  plan that rests on an overlay item can be finalized, with the mark, which changes D-400's "can't be finalized yet" for
  it (a proceed-on, §30); D-400's rule stays for an entry the overlay can't add.
- **Limits, stated wherever an overlay item is shown:** a line PoB doesn't parse stays unmeasured
  (`check_model_coverage` reports it; PoB parsed every stat line of the 17 Forbidden Rites soul cores but "Corrupting
  will always result in change", WL:6893–6894); an item on a base the pin lacks can't load; the index's rule-changer
  marks wait for us; trade weights stay the pin's (`Data/QueryMods.lua`); and it doesn't help at 1.0 itself, which
  changes the tree and the skills: only a PoB release brings those, and then our pin upgrade (§4).
- **Readers of a user-side digest:** `runningDigests` takes both folders (C-59); the runner prints its line 3 as it
  prints a committed one's, `pob2-run-log` records it, and the task header's `digests` carries its absolute path; a
  committed digest of the same league replaces it. Game knowledge starts no run and gets no `guide_run` reply, so it
  passes only `data/league/` to `runningDigests`; when no running league has a committed digest it says so once and
  reads poe2db for what's new, at D-497's pace, which its web scope already allows (D-503). Resolving the league folder
  in Bash is never a fallback, for the reason above (the coordinator's call at the consistency pass).

Amends D-400 (the sidecar; a user-side digest; an overlay item's finalization), D-401's marks (none for overlay items),
C-16 (the state folder's `league/`), C-50 (`guide_run`'s reply), C-57 (`bin/` gains `pob2-league-digest`), D-501
(`runner-rules.md`'s Bash list and write rule), D-499's "no command for the data builders" (one, for this). New
contract C-66 (§22).

## 20. D-524: real cases

**Two characters, read only, never copied** (answer 7, "My PoB file"; the coordinator's resolution of the review), in
`~/pob2-real-cases/`, outside every git repository and off the Windows drive, which agents may read (WL:6962–6983):
- **ResurrectForbidden** (`ResurrectForbidden.xml`): an unmodified poe.ninja export of a Forbidden Rites (0.5.5)
  character, level 100, the character behind PG-106 to PG-108.
- **CullTheConquerer** (`CullTheConquerer-oauth-import.xml`): one of the user's characters imported with PoB2's own
  OAuth importer, unchanged, a level 70 Lich past the campaign's last area level (64, `data/campaign/progress.json`),
  so in the early endgame (WL:6981–6983). Its `<Import>` records `lastLeague`, which poe.ninja's export doesn't.
  Neither character is below the endgame, so choice A has a real case only if the user names one at HG-39.

Both have the import's shape: `targetVersion="0_1"`, `treeVersion="0_5"`, one spec, item set and skill set, every group
enabled, each granted skill held twice. With choice D, one multi-loadout file of the private guide library
(`~/projects/poe2-guide-library/guides/*/pob/build.xml`), read in place, joins the reader's and the file run's cases.
None is copied into the repository, committed or written; no personal detail is recorded here.

**The committed fixtures,** built by hand from the game data, as `tests/fixtures/builds/granted-supports.xml` was
(`tests/fixtures/builds/README.md`), with no character hash and no account name:
- `tests/fixtures/builds/imported-character.xml` and its code, in PoB's own importer's shape: each granted skill twice,
  plain copies with no `slot` at level 20 and quality 0, one at another level, one supported (PG-106, PG-108), a granted
  group with supports, a granting item in a Swap slot; every skill on, the buffs over the Spirit (PG-107);
  `useSecondWeaponSet="nil"`; `<ModRange range="0.5">` on plain lines; a soul core on an item with ranged lines (PG-109,
  for the rolls-from-text rule); an item on a base and a gem the pin lacks (PG-110); a base PG-111 lists; PoB's guessed
  main group, not the damage skill (PG-113); a group of two active skills; a quality 20 Shrine Sceptre, its granted
  skill at 0 (PG-114); crafted, fractured, desecrated and corrupted lines, a `corruptLevel` gem, an Exceptional base's
  extra socket, a magic flask and charm, a filled charm and `Arm` slot; an owned legacy gem, Legacy soul core and tree
  jewel; an attribute override; custom modifiers, an enemy setting and a party tab for the callouts; a second loadout;
  `<Import lastLeague>`.
- `tests/fixtures/builds/imported-ninja.xml`, small, in poe.ninja's shape: its main group set by the export,
  `<Import exportParty>` only, a spec with no title, saved on weapon set 2.

**The tools' real case, during the build:** a probe from a temporary folder, its server started as `spawnServer` starts
one (trade and poe.ninja off, temporary folders), each file an import code the probe encodes in memory, `source.xml`
only in its temporary run folder, reads each file (WU-160) and compiles it measure-only (WU-161). Expected from
ResurrectForbidden (`pob-gaps.md`, PG-106 to PG-108; a15 §11): no skill-slot warning after the recount (10 ungranted
groups on 10 slots); Spear Throw's copy with Frost Nexus kept, on both weapon sets; Virtuous Barrier's level 20 copy
kept beside the tree's level 1 group; Righteous Descent's copy dropped (level 19, as PoB's); Purity of Ice's supported
copy kept, on set 2, at its sceptre's quality 10 (choice E); the buffs question, 254 reserved against 215 (Trinity 100,
Charge Regulation 40 with Clarity I's 10, Herald of Ice 30, Wind Dancer 30, Combat Frenzy 30, Ghost Dance 24);
`useSecondWeaponSet` true; the main skill asked, the file's group 14 (Twister) as plan group 11; no `importLeague`. From
CullTheConquerer: Mana Drain's copy dropped (level 18, as PoB's from the wand); Sigil of Power's supported copy kept on
set 2 (its staff in `Weapon 1 Swap`), at quality 0 under choice E; `useSecondWeaponSet` false; the main skill asked, the
file's group 3 (Essence Drain) as plan group 2, marked as PoB's guess; the Blasphemy group's two skills; `importLeague`
Forbidden Rites. Recorded in the work-log.

**The pieces' real cases, with agents** (AC-W160; choice G): after M-30 merges, the server rebuilt and reconnected
(`/mcp`), in a `--plugin-dir` session started after the merge or reloaded (`/reload-plugins`; HG-38), with
`/pob2:compile` listed, the coordinator runs, asking each step of a `pob2:` agent type (§11): `/pob2:compile` on each
character (the measure, then the better round offline);
`/pob2:pricing` offline, the user naming the rung (a trade run only with the user's approval, announced);
`/pob2:build-guide` from ResurrectForbidden (and the library file, choice D) to its design gate; `/pob2:writer` on an
accepted better round. The runs read the characters from the builds folder by the names the user gives at HG-39, each
checked unchanged against its copy in `~/pob2-real-cases/` by sha1.

**Each piece's expected results** are in its slice (§21), written in M-30 before WU-168 runs. A wrong result is fixed
in the piece's files and the case run again; the record is the work-log's.

## 21. D-525: the documents and the limits

- **One slice per piece, written current** (D-504's rule): `docs/build-guide/spec/05-compile.md`,
  `06-pricing.md` and `07-writer.md`, each with 04's headings (Scope, The contract, Requirements, Acceptance criteria,
  Work units, Real cases), listed in the spine's §4.1. Slice 04 is updated for the league rule, the Bash line and its
  description's commands.
- **Slice 03 shrinks** toward `/pob2:build-guide`'s order of calls: notes where the pieces now hold its text (§8 the
  guide template and §9 the pricing procedure point to 07 and 06; §5.2's design and writer rows to 05 and 07), and its
  file-run entry. Slices 01 and 02 gain notes for the new tool, the patches and plan schema 11, pointing here; they are
  folded at amendment 18 (D-506).
- **Where the pieces' files sit** (a proceed-on, §30; revision 0's choice 4, which has no effect a player sees): each
  piece's `SKILL.md` and its new stage reference in its own folder (`skills/compile/`, `skills/pricing/`,
  `skills/writer/`), and `pricing.md` moved to the pricing piece (§16); the pipeline's design and writer stage
  references (D1-build, D1-tree, D1-finish, D1-gate, F1, D2, D2-gate, W1) and the guide templates stay in
  `skills/build-guide/`, read by path by the compile and writer pieces, as every piece reads game knowledge's files by
  path (a15 §8).
- **Limits:** each piece's `SKILL.md` fewer than 150 lines; `/pob2:build-guide`'s under 325 at both milestones' gates
  (the user's cap, already met at 317); every stage's words loaded within 5% of its baseline (D-513).
- **The fold** (D-504): the approval commit enters this amendment's rows as approved and moves the status line to
  "Folded through amendment 16 (approved; as built through 15)"; M-29's docs unit (WU-158) marks M-29's rows built and
  the line reads "(approved; as built through 15 and amendment 16's M-29)"; M-30's docs unit (WU-167) marks the rest
  built and drops the parenthesis. `tests/static/specSpine.test.ts` checks the folded number at every gate (:68); the
  rows' status and the parenthesis are the gate verifier's to record.

# Part III. Contracts, costs, work units and criteria

## 22. The contracts

**New:**

| Id | Contract | Milestone | Defined in |
|---|---|---|---|
| C-59 | **Running leagues:** a digest's `League:` sentence on its line 3 (start and end instants, UTC); `runningDigests(folders, now)` in `skills/game-knowledge/scripts/leagues.mjs`, the one rule every reader takes, and its command line; the folders `data/league/` and, from M-30, the server's league folder, a committed digest winning; the run log's `digest` list from skill revision 15, each form where its revision puts it; the task header's `digests` | M-29 | §3, §19, Appendix A.1, A.2 |
| C-60 | **The bridge's patches:** `pob-api/API/ParseFixes.lua` (data) and `pob-api/API/Patches.lua` (functions, each a wrap on PoB's class), each entry naming its PG id, its fingerprints (function, data line or line range), its retirement test and, for a function patch, `apply` and `revert`; bootstrap steps 5c and 5d; the static fingerprint test; the upgrade script reads both and retires a patch only on its "bug still present" case | M-29 | §5, Appendix A.3 |
| C-61 | **Piece runs:** `Guides/<piece>/<date>-<n>/`; the run log's piece fields at skill revision 16, the id `file` and the new steps and scopes; the checker's piece tags and a piece run's layout; a stop ends the run, a resume is the retry | M-30 | §12, Appendix A.6 |
| C-62 | **`plan_from_build`**, the file reader (engine kind `none`, group `core`): two calls, the decoded `source.xml` kept in the run folder | M-30 | §13, Appendix A.7 |
| C-63 | **Compile, `/pob2:compile`:** `skills/compile/` (`SKILL.md`, `references/stages/measure.md`); reads a file into a plan, measures it, the callouts, the better round on request | M-30 | §15, §17 |
| C-64 | **Pricing, `/pob2:pricing`:** `skills/pricing/` (`SKILL.md`, `references/pricing.md`, `references/stages/price.md`); the league, the replace cost, the place, the upgrades; `upgrades.json` | M-30 | §16, Appendix A.10 |
| C-65 | **The writer, `/pob2:writer`:** `skills/writer/SKILL.md`; a guide for a build that passed F1, written in its own folder from a source run folder | M-30 | §18 |
| C-66 | **The overlay:** a digest's sidecar `<slug>.overlay.json`; `data/league/rune-slots.json`; the league folder `<stateDir>/league/`, named in `guide_run`'s reply; the server's sidecar list, passed to bootstrap step 5e and reloaded before a load or a compile; `pob2-league-digest` | M-30 | §19, Appendix A.11 |

**Modified** (each delta in its section; all additive for old plans and runs, §26): C-1 (86 tools, §13); C-2 (loads drop
`<ModRange>` where the text has rolls, §7); C-6 (the script, step 8, the launch note, §4, §5); C-16 (`league/`, §19);
C-31 (schema 11, §8, §13, §14); C-33 (the record's `switches`, `owned`, `overlay`); C-34 (a folder per piece, §12); C-35
(`prices.json`'s leagues, §10); C-36 (the task header's `digests`, `scope`, `source`); C-41 (`compile_plan` on a read
plan, `measure_as`, granted quality, switched buffs, the exemptions, no `<ModRange>`, §7, §8, §14, §15); C-50
(`guide_run`'s reply, §19); C-51 (the brief's `from` and `better`, §18); C-57 (a fifth `bin/` command); C-58 (game
knowledge's league and Bash lines and description, §3, §11, §12). **Existing, relied on unchanged:** C-14
(`find_upgrades`), C-17 (`buildFileWriter`), C-49 (the price tools).

## 23. Costs

An estimate in the harness's subagent token counts, as the work-log records builds: M-21, seven units, about 5.5M with
its fix rounds (WL:5297–5300); M-22 about 2.6M (WL:5453); M-23 about 3.3M (WL:5553). (Amendment 15's 2.5M was its
drafting and review, WL:6492; no build cost is recorded for M-27 or M-28.)
- **M-29:** the league rule across about a dozen files and their tests; three bridge patches with engine tests; the
  upgrade script, the probe and the rehearsal; the small fixes. About 3M to 5M.
- **M-30:** a new server tool and schema 11, the compile's read-plan rules, three piece skills with two new stage
  references, four D1 stage sections, a file run in `/pob2:build-guide`, the writer's source folder, the overlay, three
  slices. About 7M to 11M, the largest milestone yet (R-126).
- **WU-168's agent runs** (the four pieces on the real cases, in the coordinator's session): about 1.5M to 2.5M output,
  200M to 350M cache read and 5M to 8M cache write, against a whole pipeline run's 3.84M, 564M and 12.0M (WL:5604).
- **This amendment's review and fold:** §31.
- **A run's own cost:** each stage's words loaded within 5% of its baseline (D-513). A piece run loads its own
  `SKILL.md` (under 150 lines) and its stages, not `/pob2:build-guide`'s.

## 24. Work units

**The approval commit** (the coordinator's, before WU-151): this amendment's rows enter the spine as approved
(D-507…D-525, C-59…C-66 and the modified contracts' notes, M-29, M-30, WU-151…WU-168, AC-W130…AC-W162, R-118…R-130,
HG-38, HG-39, the HG-12 grant of §28), each row an Amends line names gains its "amended by" mark (D-496), the spine's
handoff section is brought up to date, and the status line reads "Folded through amendment 16 (approved; as built
through 15)", which `tests/static/specSpine.test.ts` requires once this amendment reads APPROVED (D-504's fold rule).

**Skill revisions:** 15 from M-29 (the `digest` list), 16 from M-30 (piece runs, the file run, switched buffs and
granted quality in the designs). `REVISIONS` gains each (`run-log.mjs`:265); an older run resumes at its own revision
rules, as today (a proceed-on: one revision per milestone).

### M-29: what 1.0 needs, and the shared fixes

| Unit | Kind | What | Depends on | Decisions | Criteria |
|---|---|---|---|---|---|
| WU-151 | build | Running leagues: the digest script's cards and `League:` sentence, the other digests' rewrite, the two committed digests' line 3, the fixture homepage; `leagues.mjs` and its command; the run log's `digest` forms, D-415's line, the test clock, the checker; the staleness line, the task header's `digests`, R1a, the researcher's definition, `lookups.md`, `patterns.md`:592, `references/run-log.md`; game knowledge's league lines (`SKILL.md`:66–68); the tests' helper | — | D-507 | AC-W130…AC-W132 |
| WU-152 | build | The patch frame: `Patches.lua` with PG-109's and PG-114's entries as stubs, bootstrap 5d, the three fingerprint forms on both modules (PG-103's too), each entry's `test`, the static fingerprint test; PG-106's recount (the switched mark's name fixed here for WU-161) and its tests; `pob-gaps.md`'s PG-106 | — | D-509, D-510 | AC-W133, AC-W134 |
| WU-153 | build | PG-109: the `ItemsTab` wraps, `import_build {save_as}`'s drop, their tests; `pob-gaps.md`'s PG-109 | WU-152 | D-511 | AC-W135 |
| WU-154 | build | PG-114: schema 11's `skills.granted`, the compile and its check, the `ProcessSocketGroup` wrap (choice E), `plan-reference.md`; its tests; `pob-gaps.md`'s PG-114 with both real cases | WU-152 | D-512 | AC-W137 |
| WU-155 | build | The upgrade script and S-2's probe, committed, with §4's changes to `fetch-pob.sh` or Node, `pinCheck.ts`, `compilePlan.test.ts`, the skill-slot tests and `--reflag`; the report; `CLAUDE.md`'s procedure and launch note; the dry run and the rehearsal | WU-151, WU-153, WU-154 | D-508 | AC-W136, AC-W138 |
| WU-156 | build | The small fixes: `words-loaded.mjs`:285, the baseline's two sections, its test; `prices.json` and its pins; game knowledge's Bash and Grep lines but :66–68 (WU-151's) | — | D-513, D-514, D-515 | AC-W139, AC-W141, AC-W142 |
| WU-157 | human, then the coordinator | The user starts a `--plugin-dir` session (HG-38); the coordinator probes each `pob2:` type. Outside M-29's gate; recorded by WU-168 at the latest | the user | D-515 | AC-W140 |
| WU-158 | docs | M-29's documents: slice 04's league rule and Bash line; notes in 01, 02 and 03 for the patches, schema 11's `skills.granted` and the league rule; the spine's M-29 rows as built | WU-151…WU-156 | D-525 | AC-W143 |

WU-151, WU-152 and WU-156 start together, each in its own worktree; WU-151 and WU-156 share game knowledge's
`SKILL.md` and `buildGuidePipeline.test.ts` in separate hunks. WU-153 and WU-154 follow WU-152, in parallel,
sharing `Patches.lua` (WU-152 lays out both entries) and `pob-gaps.md` in separate hunks. WU-155 waits for the
fingerprints and the new line 3. WU-157 runs whenever the user has started the session. **M-29's gate** passes when
AC-W130 to AC-W139, AC-W141 to AC-W144 and AC-W162 hold, `mise run test` and `pnpm build` exit 0,
`scripts/fresh-clone-check.sh` passes, and the load check (a15 §4) passes on the merged tree; the gate's verifier
records each. M-29 merges to `main` (signed with the user, HG-8) before M-30 starts, so 1.0's needs land first.

### M-30: the pieces

| Unit | Kind | What | Depends on | Decisions | Criteria |
|---|---|---|---|---|---|
| WU-159 | build | Piece runs: `init`'s piece fields, revision 16, the stop and the resume, the id `file`, the new steps and scopes, the checker's piece tags, a piece run's layout and skipped checks, the renders' root build, the design display, the compaction reminder | M-29 | D-516 | AC-W145…AC-W147 |
| WU-160 | build | `plan_from_build`: the parser's fields, base matching, the tree version, the two calls, the tool (schema, meta, router, handler), the README table and counts; the run settings example's allow list; schema 11's read fields and `switch`; the two fixtures; the probe's read half | M-29 | D-517 | AC-W148…AC-W150 |
| WU-161 | build | The compile on a read plan: `config.file` and its callouts, `measure_as`, the owned exemptions, the switched buffs (written off and marked, measured, `switched-spirit`, the record); the probe's compile half | WU-160; merges after WU-159 | D-518, D-519 (C-41's part) | AC-W151, AC-W152 |
| WU-162 | build | `/pob2:compile`: `skills/compile/SKILL.md`, `measure.md` with the file card, the coordinator's step table, the better round's D1 sections and checker rule; game knowledge's description; its words-loaded entry; a fixture compile run | WU-159, WU-161 | D-519, D-521 | AC-W153, AC-W154 |
| WU-163 | build | `/pob2:pricing`: `SKILL.md`, `price.md`, `pricing.md` moved and every path to it, the league, the owned rare's spec, the place (choice B), `placement` and `owned-spec`, the upgrades and `upgrades.json`, compile's placement line; its words-loaded entry; fixture pricing runs (offline, and online through `fixtureFetch`) | WU-159, WU-161 | D-520 | AC-W155 |
| WU-164 | build | A guide from a file: the brief's `from` and `better`, the slug, the steps before 6a, `checkFlow4`'s file-run order, the ladder scope and the placed rung's report, the placement after a better round, a guide's rules on owned content, W1's switched lines and `switched-buffs`, the designers' switched-buff and quality lines and the guide's quality line; `SKILL.md` under 325 lines; a fixture file run | WU-162, WU-163 | D-512 (the designers), D-518 (W1 and the designers), D-522 | AC-W144, AC-W156, AC-W157 |
| WU-165 | build | `/pob2:writer`: `SKILL.md`, W1's `source`, the renders' `--source`, `init`'s refusal of a source with no D1-gate verdict, a guide's rules on owned content, the checker for a writer run; a fixture writer run | WU-164 | D-522 | AC-W158 |
| WU-166 | build | The overlay: the sidecar, `rune-slots.json`, `pob2-league-digest` and its rules, the league folder in `guide_run`'s reply, `runningDigests` and the run log, the server's sidecar list and reload, step 5e, retirement and marks, the run settings example, `runner-rules.md`'s Bash list and write rule, the fetch line in build-guide's `SKILL.md`, `start.md` and the three piece `SKILL.md`s; the upgrade script's overlay step | WU-159; merges after WU-165 | D-523 | AC-W159 |
| WU-167 | docs | Slices 05, 06 and 07; slice 03's notes and shrink; slice 04's commands; notes in 01 and 02; the spine as built, the status line's parenthesis dropped | WU-159…WU-166 | D-525 | AC-W161 |
| WU-168 | human, then the coordinator | After M-30 merges: the user starts a `--plugin-dir` session (new, or `/reload-plugins`) and reconnects the rebuilt server; the coordinator runs the pieces' real cases (§20; choice G, HG-39), and AC-W140 if WU-157 hasn't run | M-30's merge | D-524 | AC-W160 (AC-W140) |

WU-159 and WU-160 start together; WU-161 follows WU-160 and merges after WU-159; WU-162 and WU-163 run in parallel after
WU-159 and WU-161, each owning its own skill folder, WU-163 adding the `price` row and compile's placement line after
WU-162 merges; WU-166 runs beside WU-161 to WU-165 and merges last of the build units, after WU-165. A breach of a bound
(a `SKILL.md`'s lines, a stage's words) is fixed by the unit whose text caused it. **M-30's gate** passes when AC-W139,
AC-W142, AC-W144 to AC-W159, AC-W161 and AC-W162 hold, `mise run test` and `pnpm build` exit 0,
`scripts/fresh-clone-check.sh` passes and the load check passes on the merged tree (the five skills, three new, and the
four agent types listed; the always-on cost recorded against R-115's). AC-W160 and AC-W140 are recorded at WU-168; until
then the spine marks M-30 "built, WU-168 open", as M-28 was before HG-37.

## 25. Acceptance criteria

### M-29

- **AC-W130 (running leagues; WU-151).** `runningDigests` on five fixture digests (ended, running with an end, running
  with none, not started, undated), at set instants: between the later start and the end, the two running ones, the
  later start first; at the end instant, only the one with no end; never the other two; with two folders, a committed
  digest replaces a user-side one; `leagues.mjs --at` prints the same. On a temporary copy of the committed digests:
  both at 2026-12-11 19:59 UTC, `forbidden-rites.md` first; none at 20:00. With the test clock, `init` and `resume` at
  revision 15 record the list; a revision-14 log resumed at 15 keeps its top-level string, records a list in its new
  entry, and D-415's line compares them; the checker accepts each form where its revision puts it, and a revision-14
  fixture run passes unchanged. Unit tests.
- **AC-W131 (the digest script's dates; WU-151).** On a fixture homepage with three cards (one with an event slot) and
  a section per card, the script writes the `League:` sentence of Appendix A.1 from the "Running for" or "Starts in"
  slot and the "Ends in" slot, ignores the event slot, matches by the version label, rewrites another digest's sentence
  in its output folder and prints the change, writes none for a section with no card and says so; `--reflag` keeps the
  sentence. No request is made (fixtures). Unit test.
- **AC-W132 (the readers; WU-151).** Both committed digests' line 3 carry Appendix A.1's sentence with the instants of
  §3; `skills/build-guide/SKILL.md`, `references/start.md`, `references/run-log.md`, `stages/R1a.md`, the researcher's
  definition, `skills/game-knowledge/references/lookups.md` and `skills/game-knowledge/SKILL.md` name running leagues
  and no longer choose "the newest" digest "by its fetch date"; game knowledge keeps its poe2db fallback and reads an
  ended league's digest only when the user asks; the task header documents `digests`. Static test.
- **AC-W133 (the patch frame; WU-152).** Every entry of `Patches.lua` and `ParseFixes.lua` has a PG id, a fingerprint
  and its `test`; bootstrap applies 5c, then 5d, before the server starts (as `parseFixes.test.ts`:186–195); the
  fingerprint test passes on the pin and fails, naming the patch and the file, on a temporary copy with one
  fingerprinted line changed; an `apply` over a missing method refuses, and the engine starts without it. Static and
  engine tests.
- **AC-W134 (PG-106; WU-152).** On a fixture of 9 plain groups and a plain Purity of Ice copy with a support, PoB's
  `GemGroupCount` is 9 and the build has no skill-slot warning; with one of 10 plain groups disabled and marked switched
  it is 10; with the patch reverted the first fixture's is 10; `skillSlots.test.ts` passes. Engine tests.
- **AC-W135 (PG-109; WU-153).** A fixture item with a socketed rune and ranged lines, saved through the export, gives a
  file with no `<ModRange`, and the reload reads every roll as before; a file holding PoB's copies and `{range:}` text
  loads its rolls from the text; one without `{range:}` loads its `<ModRange>` rolls; `import_build {save_as}` of a code
  holding the copies writes none on its `{range:}` items; with both wraps reverted, PoB's own save and load move the
  rolls. Engine tests.
- **AC-W136 (the upgrade script on real trees; WU-155).** `scripts/pin-upgrade.mjs v0.23.1` on the integration tree
  exits 0, leaves the tree as it was (the report aside, no digest written) and lists no judgment item; on a scratch
  branch to the release before the pin, discarded after, it records each step's result, the judgment list and the
  mechanical part's elapsed time. Both run in the background under the gate lock; the work-log records the output.
  Recorded by the unit and the gate's verifier.
- **AC-W137 (PG-114; WU-154).** A fixture with a quality 20 Shrine Sceptre (its base and Purity named, the resistance
  under its cap) measures its Purity at quality 20, the resistance 8 points over quality 0, also with the granted group
  saved at 0; a plan's `skills.granted` 20 on a tree-granted skill measures 20, and again after a save and reload;
  `compile_check` refuses a name nothing on the stage grants; with the wrap reverted the Purity reads 0; every schema-10
  plan fixture compiles to its old record. Engine and unit tests.
- **AC-W138 (the upgrade script; WU-155).** On fixtures, with no network and no engine (a local `file://` remote, an
  injected gate result): it refuses a branch and a commit; it lists a changed fingerprint and retires nothing for it; it
  removes a patch's entry and test when the test fails on its "bug still present" case, and lists any other failure;
  it lists `Trade.lua` and `construct()` only when their mirrored files differ; its probe and candidates steps get
  temporary folders; its report has A.4's shape. The probe and its symbols are committed; the skill-slot tests find
  PoB's line by text; `CLAUDE.md` names the script and step 8 and has the launch note. Unit and static tests.
- **AC-W139 (words loaded; WU-156).** `words-loaded.mjs` leaves out another stage reference that only the definition
  names; the baseline's `a8d735c` section equals `--at a8d735c --json` and each later entry `--at` its commit; the pins
  are hand counts at `a8d735c` under the new rule (the survey's simulation: R1b 67,356, D1-build 82,765); a stage under
  any `skills/<piece>/references/stages/` is found; every stage is within 5% of its baseline on the merged tree. Unit
  test.
- **AC-W140 (the agent types' search; WU-157, recorded by WU-168 at the latest).** For each of the four `pob2:` types,
  the work-log records one Grep and one Glob call that returned results, in a `--plugin-dir` session. Recorded.
- **AC-W141 (`prices.json`; WU-156).** The six league facts carry §10's patches and values, the new ones citing the
  poe2db source; the conversion facts keep `0.5.x`; the file passes `factSchema`; the static test pins the new values.
  Static test.
- **AC-W142 (game knowledge's Bash line; WU-156).** `skills/game-knowledge/SKILL.md` no longer says "You need no Bash",
  tells its runner to search with `grep` through Bash, and stays under 150 lines; no agent definition names Bash (R-4).
  Static test.
- **AC-W143 (M-29's documents; WU-158).** Slice 04 states the running-league rule and the Bash line; slices 01, 02 and
  03 carry §21's notes for M-29; the spine names C-59 and C-60; `specSpine.test.ts` passes; the gate's verifier records
  M-29's rows built and the status line (the test checks only the folded number, :68). Static tests and a record.
- **AC-W144 (`/pob2:build-guide`'s size; WU-164, held at both milestones' gates).** `skills/build-guide/SKILL.md` has
  fewer than 325 lines. Static test.

### M-30

- **AC-W145 (a piece run's log; WU-159).** `pob2-run-log <folder> init` with `piece: "pricing"` and no slug or brief
  writes Appendix A.6's fields at revision 16 and refuses a `piece` outside the three; a piece-run log with a `slug` or
  `brief` is refused; `resume` works on a piece folder. Unit test.
- **AC-W146 (a stop ends a piece run; WU-159).** A piece run whose `price` entry counts `rate_limited` has a
  `pricing.stops[]` entry and status `stopped`, and its runner text asks for the rung first when none is placed;
  `resume` clears the stop; `pob2-run-log … pricing` is refused in a piece run. Unit and static tests.
- **AC-W147 (the checker by piece; WU-159).** Every rule name the checker can emit has a piece tag (a static scan of its
  `fail('<rule>'` calls against the table); every pipeline fixture gives its result at `cf16e07`; a fixture compile, a
  pricing and a writer run each pass, and fail on a planted fault of their piece's rule only; the slug-from-brief and
  flow rules don't fire on a piece run (a better round's D1 order aside, AC-W154); the id `file` and the scopes `better`
  and `ladder` pass at write and in the checker; the renders take a piece run's root build; the reminder names any pob2
  run. Unit and static tests.
- **AC-W148 (the reader's contract; WU-160).** The server lists 86 tools (85 with poe.ninja off, 79 with trade and
  poe.ninja off), `plan_from_build` among them with engine kind `none`, group `core` and a description under 2,048
  characters; the README table is regenerated; the tool-hygiene allowlist stays empty; each refusal of §13 is an
  `isError` that writes nothing, a missing tree version among them; a copy of the importer fixture on the `0_4` tree
  asks the tree question; the first call keeps `source.xml` and its sha1; neither the builds folder nor the source
  changes. MCP and unit tests.
- **AC-W149 (the reader on the fixtures; WU-160).** By name and by code the importer fixture gives the same plan but
  `source`, with each rule of §13 met on its case: rolls, bases, `left` and `stand_in`, PG-111's line, the granted
  copies by support, level and weapon set, no `skills.granted` for a 0, plan-numbered questions, `mainActiveSkill`,
  `"nil"` as false, `role`, `config.file` and `enemyIsBoss`, `importLeague`, `buffs_on` and `buffs_swap`, `corrupt`,
  `treeJewels`, `attributeChoices`; the plan passes schema 11. The poe.ninja fixture: its main group as set, no
  `importLeague`, set 2, its untitled spec. Neither holds a character hash or account name. Unit test.
- **AC-W150 (the reader's real cases; WU-160).** The probe of §20 reads each real case (with choice D, the library file
  too) and gives §20's expected read results; nothing is written outside its temporary folders; the work-log records the
  results and each file's sha1, unchanged. Recorded.
- **AC-W151 (the compile on a read plan; WU-161).** The importer fixture's read plan compiles measure-only with
  `measure_as`: no V1, V2 or checker failure for owned content, every exemption of §15 exercised; its `config.file`
  inputs written as read, no reference hit filled, V2's findings `from-file`; the boss, resisting, Arbiter and toughness
  reads in the record, no variant given; the same item in a design's slot without the mark fails as today. The probe's
  compile half gives §20's measured results (recorded). Engine and unit tests.
- **AC-W152 (switched buffs; WU-161).** A stage with one switched group measures with it off and marks it for the
  recount; the record's `switches` holds its set with its `off` groups off, measured on set 2 on a stage using set 2;
  V1 reports `switched-spirit` for a switch that leaves Spirit below 0 and nothing for one that fits; a stage without
  `switch` compiles to its old record. Engine and unit tests.
- **AC-W153 (`/pob2:compile`; WU-162).** `skills/compile/SKILL.md` exists with fewer than 150 lines, frontmatter `name`
  and `description` only, at most 1,536 characters, naming when to use it and `/pob2:build-guide`, `/pob2:pricing`,
  `/pob2:game-knowledge` for the rest; it reads `runner-rules.md` first; `measure.md` holds §15's parts; the
  coordinator's step table names `measure`; game knowledge's description names the three new commands; every
  root-folder path resolves (AC-W115's test). Static test.
- **AC-W154 (the better round; WU-162).** D1-build, D1-tree, D1-finish and D1-gate each hold a `scope: "better"`
  section; a fixture compile run with a better round (offline) passes the checker, its D1 loop in order; the checker
  fails a planted round whose missed target isn't shown as a finding; its design display names the draft first; no file
  name equals the source's. Static and unit tests.
- **AC-W155 (`/pob2:pricing`; WU-163).** `skills/pricing/SKILL.md` (fewer than 150 lines, `name` and `description`
  only, at most 1,536 characters) and `price.md` exist; `pricing.md` is at its new path, its text unchanged but for
  paths, and no file under `skills/`, `agents/`, `src/`, `scripts/` (the baseline aside) or `tests/` names the old one;
  `placement` gives `m`, `b` and `n` on three fixture price sets and `n` for a dear unique (choice B), and `owned-spec`
  passes §16's spec; each fails a planted fault; `price.md` asks for the rung without trade or under `--no-ninja`, and
  for an unlisted league (static); without a cookie the upgrades are links; `upgrades.json` has A.10's shape; online
  (through `fixtureFetch`) and offline fixture runs pass the checker; pipeline fixtures keep their results. Unit and
  static tests.
- **AC-W156 (a guide from a file; WU-164).** The brief accepts `from` and `better` and gives the slug `file`; a fixture
  file run (offline) passes the checker in the file-run order (`read`, `measure`, `place`, then `D1-build`; no R1a, R1b
  or verification gate), its placed rung's items kept, its rares as specs, a planted owned legacy gem shown as a trade,
  the other rungs designed, the placed rung's floor and tree parts findings (a planted run that fails it for them
  fails); with "better" the result is placed again; a declined campaign runs no D2; the file entry, the quality-20
  lines and W1's quality line exist. Static and unit tests.
- **AC-W157 (switched buffs in the guide; WU-164).** On a fixture build with a switched buff, W1's guide has §14's line
  for it, and the checker's `switched-buffs` fails a guide without it. Unit test.
- **AC-W158 (`/pob2:writer`; WU-165).** `skills/writer/SKILL.md` exists with fewer than 150 lines, frontmatter `name`
  and `description` only, at most 1,536 characters; a fixture writer run on a fixture file run's folder passes the
  checker, its guide and audit in its own folder and none in the source; `pob2-run-log init` refuses a measure-only
  compile run as the source, naming the better round; on a better round's source the owned rares are specs and a planted
  legacy gem is refused. Static and unit tests.
- **AC-W159 (the overlay; WU-166).** From fixture pages the script writes Appendix A.11's sidecar, with `type` and
  `statOrder`s; `rune-slots.json` maps every in-pin socketable label of `runes-of-aldur.md` to `Data/ModRunes.lua`'s
  keys; an item of each slot type parses with an overlay entry loaded; a `startTestServer` with a fixture sidecar in a
  temporary league folder measures an overlay soul core and marks `overlay`, also when the sidecar appears after the
  engine started; a committed sidecar wins; a retired entry is skipped, logged and reported by `--reflag`; `--running`
  runs only when no running digest exists or the newest records no end, reads the cards once a UTC day, fetches only
  running leagues without a digest at D-497's pace, no cookie, writes only its league folder, and nothing offline; a
  user-side digest reaches `init` and the header; `guide_run`'s reply names the folder; the marks' wording is in the
  guide, audit and gate displays; `bin/` holds five executable commands, and `runner-rules.md` names the new one. Unit,
  engine and static tests.
- **AC-W160 (the pieces' real cases; WU-168, after M-30).** The work-log records, for each run of §20: the command, the
  `pob2:` types started and their tool calls, the run folder, what it measured or priced against §20's expected
  results, and the source's sha1 in `read.json` equal to its copy's. Recorded.
- **AC-W161 (M-30's documents; WU-167).** Slices 05, 06 and 07 exist with 04's headings; slice 03 carries §21's notes;
  the spine names C-61 to C-66; `specSpine.test.ts` passes; the gate's verifier records the rows built and the status
  line "Folded through amendment 16". Static tests and a record.
- **AC-W162 (the pipeline unchanged; every build unit, held at every gate, the milestone's verifier its one owner).**
  Every pipeline fixture gives the checker's result it gave at `cf16e07`. Each assertion the milestone's diff under
  `tests/` changes is listed by its unit with the decision that forces it (for example the revision-14 pins `resume`'s
  stamp moves, `run-log.mjs`:737–745), and the verifier checks each against that decision and records it, with
  `mise run test`. Recorded.

# Part IV. Migration, risks, gates and the user's choices

## 26. Migration and compatibility

- **Runs.** Old run folders resume: the top-level `digest` keeps the form of the revision `init` wrote, and a resume
  after M-29 records a list in its own entry (§3); none names a skill path, so `pricing.md`'s move doesn't touch them
  (a15 §2). The user runs nothing until the split ends (a15 §1).
- **Plans.** Schema 10 and older plans compile to their old records (AC-W137, AC-W152); schema 11 only adds fields.
  The plans' writers move to 11 with M-30's designs; a read plan is always 11.
- **Files the server writes** carry no `<ModRange>` from M-29 (§7), `import_build {save_as}`'s on its `{range:` items.
  PoB, desktop or ours, reads each roll from the item text, which it wrote itself; desktop PoB opens them right, and its
  own next save adds its misnumbered copies back (§7's limit). Files written before M-29 load right in our engine (the
  load side).
- **The digests.** The two committed digests gain their `League:` sentence by hand; any digest made later by the script
  has one. A user-side digest and its sidecar live in the server's league folder (C-16), which an update leaves alone.
- **The pin is unchanged** (v0.23.1, HG-11). The upgrade script is tooling; upgrading stays the user's call.
- **The user's steps:** a `--plugin-dir` session for WU-157 and WU-168, new or after `/reload-plugins` once `main`
  changes (HG-38), nothing installed; reconnecting the server (`/mcp`) after a rebuild, before the real cases (WU-168),
  as `CLAUDE.md` says.
- **Rollback.** Each milestone merges on its own; a revert of M-30 leaves M-29's league rule, patches and script; the
  patches can be turned off one by one by removing an entry, and the engine starts without a patch whose `apply` fails.

## 27. Risks

| Id | Risk | Rating | Mitigation |
|---|---|---|---|
| R-118 | M-29 isn't merged before 1.0 starts (2026-12-11 20:00 UTC), and the readers take ended leagues | medium | M-29 first and merged before M-30 starts (§24); its units small; the league rule needs no network; its gate waits on no session of the user's |
| R-119 | 1.0's PoB release changes PoB's internals so much (S-2 warned of the class-system rewrite, `S-2-pin-v0.23.1.md`:166–167) that the upgrade script's mechanical steps leave most of the work as judgment | high | the script still lists every item; the probe names each changed symbol; the rehearsal on the release before the pin proves the steps on a real difference and times them (AC-W136); the upgrade is ours, not users' |
| R-120 | poe2db changes its homepage cards, and the script finds no dates | medium | it says so and writes none; an undated digest isn't read as running, and its reader names it (fail-closed, §3) |
| R-121 | The fail-closed rule leaves a run with no digest at all (no dates, or no digest for a new league) | medium | the runner's line says so; game knowledge falls back to poe2db.tw; from M-30 `pob2-league-digest --running` names and fetches a running league with no digest; `CLAUDE.md`'s launch note commits the new league's digest before or at launch (§4) |
| R-122 | A fingerprint trips at an upgrade that leaves the patch's bug alone (a whole method, such as `ProcessSocketGroup`) | low | a changed fingerprint means re-check, never retire (§4); the line-range form narrows a cut (A.3) |
| R-123 | The owned exemptions let a design's item through a rule it should meet | medium | only the reader marks content owned; a design that replaces an item drops the mark (AC-W151); a guide applies the rules to owned content too (§15) |
| R-124 | The D1 stages' better and ladder sections push a stage past its 5% words-loaded bound | medium | the sections are short; on the new rule every stage starts 0.5% to 1.6% under its baseline (§9); the unit that breaches trims |
| R-125 | The file card's judgment fields (chain, enabler, traps) misread a player's build, and D2 and W1 repeat the mistake | medium | the user sees the pitch at the design gate's interview; the card cites the read plan; V4 checks the guide's claims |
| R-126 | M-30, the largest milestone yet, doesn't fit one build | medium | its units are bounded by folder; the overlay (WU-166) is last and can move to a milestone of its own with the user's yes (§29) |
| R-127 | The pieces' real cases run only after the merge (WU-168), so a defect they find needs a fix on `main` | medium | the tools' real cases run in the build (AC-W150, AC-W151); fixture runs cover each piece's flow; a fix after the merge follows HG-37's precedent |
| R-128 | The overlay's slot table maps a poe2db label to the wrong PoB key, and a rune measures in the wrong slot | low | the table is checked against the pinned corpus (AC-W159); an unknown label is skipped and listed |
| R-129 | An agent's read of a user-side digest in the state folder, outside the working directory, asks for approval | low | as R-114: auto mode asks once; amendment 18's packaging moves it into the plugin's data folder |
| R-130 | A replace cost by spec misleads a player whose rares roll far above their tiers' minima | low | the replace cost is defined as the same must-have stats, said in the display; a target never fails (D-371); upgrades are listings |

## 28. Operational guardrails and human-decision gates

- **HG-12, the grant for this amendment's build** (the user's answer 3 grants the tool; approval grants the rest):
  `plan_from_build`, its `source.xml` in the run folder; `compile_plan` on a read plan (`config.file`, `measure_as`, the
  owned exemptions, granted quality, switched buffs, the record's `switches`, `owned` and `overlay`), `compile_check`'s
  refusal of a `skills.granted` name nothing grants and its owned-legacy exemption; the skill-slot recount's effect on
  every reply that reads PoB's warnings (V1, `get_build_issues`, the advice report, the load replies); `<ModRange>` left
  out of every file the engine composes (`compile_plan`, `lua_save_build`, `export_build`, the snapshots) and of
  `import_build {save_as}`, and dropped by every load (`lua_load_build`, `lua_reload_build`, `analyze_build`,
  `compare_builds`); `guide_run {new_run}`'s league-folder line; the overlay's entries wherever PoB's data shows them
  (the lookups mark them "not in PoB's release", a proceed-on); plan schema 11. For M-29 and M-30 only.
- **HG-38: the plugin in the coordinator's session, loaded in place** (WU-157, WU-168; the coordinator's resolution of
  the review). The user starts the session with `claude --plugin-dir /home/parker/projects/pob2-mcp`, which loads the
  plugin from the main checkout in place and copies nothing, so the coordinator can start `pob2:` agent types. Nothing
  is installed for this project: an install copies the whole folder, `.env` with the trade cookie included, into Claude
  Code's plugin cache (WL:6861–6863, HG-37), and would put `main`'s `bin/` on every build session's PATH. After `main`
  changes, a new session or `/reload-plugins` loads it (code.claude.com/docs/en/plugins/loading).
- **HG-39: the pieces' real cases** (WU-168), after M-30 merges: who runs them and where they may write is choice G
  (§30). The user names the characters in the builds folder (and the library file, choice D, or lets the coordinator
  pick it) and, for choice A, any character below the endgame to run (neither real case is, §20). The files stay read
  only and uncommitted (§20). Trade only with the user's approval, announced, one client, the server's pace
  (`CLAUDE.md`).
- **HG-11 and HG-2:** the pin doesn't change; the upgrade script runs only on the user's decision.
- **Unchanged:** tests never touch the network (D-34): the digest script's tests, the pricing runs (`fixtureFetch`) and
  the upgrade script's tests use fixtures; poe2db at D-497's pace; no `claude -p` anywhere (WL:6870–6871): the load
  check's `claude plugin validate` and `plugin details` are the only uses of the binary; never `.env`; `vendor/` never
  modified; one full gate at a time, nice'd; builds in worktrees with signing off, finalized with the user (HG-8); no
  new dependency (HG-10): zlib is Node's, the XML parser is the read-back's; engine tests on `engineDescribe`, the
  overlay's server tests on `startTestServer` with a temporary `deps.stateDir` or `spawnServer` with a temporary
  `XDG_STATE_HOME`.
- **Writes:** a builds-folder write (the better round's draft and final files) goes through `buildFileWriter` (C-17),
  backup first, never over a file that changed on disk; the file reader writes only its run folder, through the guides
  root's confined resolver; the overlay command writes only its league folder, the pages it saves included.
- **This environment only** (D-506): no POSIX-only dependency beyond `bin/` and the reminder (`pob2-league-digest` is a
  `bin/` command like the other four); the new scripts build paths with Node's `path`; the upgrade script fetches the
  pin through `mise run pob:fetch` and a staging tree through `fetch-pob.sh`'s new mode or git from Node (§4).

## 29. Departures

From the handoff's scope and the user's answers:
- **The pieces' real cases with agents run after M-30 merges, not during the build** (§20, WU-168). Amendment 15's
  roadmap had a piece's proof "on the build's own tree" (a15 §11), but the agents reach the new tool only through the
  session's server, which runs `main`'s build, and the user's folders sit behind that server. The tools' real cases do
  run during the build, through a probe server (AC-W150, AC-W151).
- **Probing the agent types needs the plugin in the coordinator's session** (HG-38), a user action the scope didn't
  name: a `--plugin-dir` session, not an install, and outside M-29's gate.
- **`/pob2:writer` alone is included,** with a source folder (§18): the roadmap's "compile and the writer" names it,
  though a guide from a file reaches W1 through `/pob2:build-guide`. It is the smallest of the pieces' units.
- **The guide library's files** (the approved roadmap's real cases, a15 §11): one joins by choice D; under its
  alternative, their drop is this departure.
- **Not in this amendment:** PG-112 (ours, node power's cache across a radius jewel; the scope names it nowhere and the
  fix policy is PoB's bugs); PG-65 stays a workaround (the scope); the pipeline's side of PG-111 keeps its workaround.
- **Size.** The scope fits two milestones, but M-30 is the largest milestone yet (R-126). The proposal, if its first
  units show it won't fit: the overlay (WU-166, last by the user's word) moves to a milestone of its own, M-31, with the
  user's yes; nothing else moves.

## 30. The user's answers, the choices at approval, and proceed-on assumptions

**The user's answers** (§1): (1) §24; (2) (a) §15, §16; (b) §16, §18; the better round §17; (3) §13; (4) §13, §15;
(5) §14; (6) §16; (7) two characters, §20; (8) §8; (9) §19. Each decision cites its source in its section: a user's
answer, the coordinator's call (accepted), or the drafter's call; the drafter's calls are the proceed-ons below, and
the review's resolutions are §31's.

**The choices at approval** (the recommendation first):
- **A. A character below the endgame** (under level 65, the first waystone tier's area level, or its owner says it is
  in the campaign; §15 to §18). Recommended: measure it as §15 does, report its place as "in the campaign" instead of
  a rung, and aim the better round at `m`'s targets. The alternative: compile and pricing measure and price it, but the
  better round and a guide from a file accept only an endgame character.
- **B. The budget rung and dear uniques** (§16). Recommended: a character is on `b` only if every rare is within about
  5 divines and no unique costs more than about 5 divines, so one dear unique places it on `n`. The alternative: the
  per-rare reading of revision 0, uniques left out.
- **C. An upstream fix for PG-109** (§5, §7). Recommended: after M-29, the coordinator drafts the PR for PoB's
  repository for the user to approve and open (the fix policy). The alternative: none for now, recorded.
- **D. A guide-library file as a real case** (§20; the approved roadmap had them, a15 §11). Recommended: one
  multi-loadout library file joins the reader's and the file run's real cases, read in place, nothing copied, the user
  naming it or telling the coordinator to pick. The alternative: the drop recorded as a departure (§29).
- **E. Which items pass their quality to the skills they grant** (§8; a granted skill's quality is the larger of its
  group's and its item's). Recommended: sceptres only, the case issue #2575 shows; every other granted skill keeps its
  group's quality, the plan's or the file's. The alternative: every item, as PR #2577 does.
- **F. Where a guide from a file starts** (§18). Recommended: `/pob2:build-guide` from a file, the pipeline's order of
  calls with the compile piece's steps in front. The alternative: `/pob2:compile <file> guide`.
- **G. Who runs the pieces' real cases after M-30 merges** (§20, HG-39). Recommended: the coordinator runs them in a
  `--plugin-dir` session (the server rebuilt and reconnected), reading the characters from the builds folder by the
  names the user gives, each checked unchanged against its copy in `~/pob2-real-cases/` by sha1; they write their own
  folders in the user's guides folder and the better round's draft and final PoB files into the builds folder under
  their own names, never over an existing file, and price nothing on the trade site without the user's approval: an
  HG-6 grant for these runs only. The alternative: the user runs them, as at HG-37, and records what they show.

**The drafter's proceed-on assumptions** (each open to the user's change at approval; each section marks its own):
- names and shapes: `leagues.mjs`, `pin-upgrade.mjs`, `Patches.lua`, `plan_from_build`, the pieces, their commands,
  stages, scopes, files and the id and slug `file`; bootstrap steps 5d and 5e; skill revisions 15 and 16; M-29 merged,
  and its rows marked built, before M-30 starts;
- league choice: the `League:` sentence and its place; the card labels as a time's only meaning; the other digests
  rewritten in the same run; an undated digest not running; a league not yet started answered from poe2db; D-415's
  string-to-list comparison;
- the upgrade script's tag pattern, report and rehearsal target; the fingerprint's three forms; PG-106's literal reading
  (no enabled active gem counts nothing, a switched group counts); PG-109 per item with a `{range:` tag;
  `skills.granted`'s form, unpriced, its guide line naming no method;
- the words-loaded baseline's second section; `prices.json`'s `0.5.x` conversion facts and 1.0's poe2db name;
- the reader: engine-free parsing (D-517), its two calls, one loadout per read, the tree question, the read stage `f`,
  PG-108's rules, plan numbering, the groups' `role`, a null `league`, the scenario's source form;
- compile: the engagement distance, `measure_as`, the callouts' kinds and when (b) and (c) show, `from-file`, `n`'s
  targets as where a character is headed, the file card, choice A's level 65, the owned exemptions beyond the scope's
  list;
- switched buffs: `when` and `off`, `buffs_swap`, `switched-spirit`, `switched-buffs`, the plan's own weapon set;
- pricing: crafted and desecrated lines as explicit mods, a corrupted implicit left out, item level at most 82, the
  reading of "about", `pricing.md` in the pricing piece with the pipeline's pricing inline (§16), one capped
  `find_upgrades` a slot, the user picking upgrades, `placement` and `owned-spec`;
- the better round's keep list, file names and unreachable targets shown; a file run's brief fields, declinable
  campaign, skipped R1a and R1b, the placed rung's parts as findings, a file below the endgame seeding all three rungs;
  the writer's source folder and refusals;
- where the pieces' files sit (revision 0's choice 4, made a proceed-on by the coordinator's resolution: no effect a
  player sees): the pipeline's design and writer references and the guide templates stay in `skills/build-guide/`, read
  by path;
- the overlay: the fetch's trigger, once a UTC day, none offline; the state folder named by `guide_run`; the sidecar,
  the slot table, a committed one winning, the reload; the marks; an overlay item finalizable with its mark (changing
  D-400's "can't be finalized yet" for it);
- the tools' real cases through a probe server, each file an import code made in memory.

## 31. The independent review and its resolution

Five lenses, each told to find one class of problem in revision 0 and to cite ground truth for every finding: invented
decisions and departures from the user's intent (L1, 20 findings); unverifiable criteria, a broken work-unit graph and
missing failure paths (L2, 33); claims about the code that don't match it (L3, 22); PoB2 and bridge claims, the patch
and overlay designs (L4, 24); designs that fight the environment, the house conventions or the standing rules (L5, 16).
115 raw findings, 13 high, 65 medium, 37 low, in `scratchpad/a16/review/` (the coordinator's session folder; not
committed), clustered into 58 material clusters (14 high, 44 medium), 24 low notes and six contradictions between
fixes. Three skeptical verifiers checked each cluster against the repository, `vendor/`, the memory files and the real
cases: 34 confirmed, 20 partly, 4 refuted. The coordinator resolved the contradictions and the clusters that needed the
user; the fold re-checked each fix's facts about the code. Folded:
- **Characters, owned content and the reader** (K1, K2, K4, K5, K8, K9, K12, K16, K19, K22, K24, K25, K31, K35 to K37,
  K48): choices A and B; placing again after a better round; `n`'s measures; the exemptions' scope; a guide's rules on
  owned content; the file's league and tree version; two calls with `source.xml`; the duplicates' rules; two fixtures.
- **The patches** (K10, K17, K26, K27, K30, K58): wraps on PoB's classes; the switched slot counted; quality the larger
  of group and item; `import_build {save_as}`; choice C; the line-range fingerprint.
- **The upgrade script** (K38 to K42): a rehearsal on a real difference; `--reflag` on change only; conditional
  judgment; the staging fetch; lines found by text; retirement on "bug still present" only; the probe's env.
- **League launch and the overlay** (K6, K7, K11, K20, K21, K28, K29, K43, K49): `digest` forms by revision; the poe2db
  fallback; the fetch's trigger and folder; the sidecars' fields; the server's list and reload; the launch note.
- **The environment, the graph and the records** (K3, K14, K18, K32 to K34, K44 to K47, K50 to K52, K54 to K57): a
  `--plugin-dir` session; the reminder; `/reload-plugins`; the probe outside M-29's gate; the run log's sites; ownership
  and merge order; checkable criteria; the overlay's finalization; choice D; decisions' sources; the costs.
- **Low notes:** 23 of 24 applied, and L2-32 in part (AC-W149's "but `source`"; no lettered sub-checks, since each
  criterion's verifier names the clause that failed).

**Not folded:** the refuted K13 (the loadout question already names any loadout), K15 (the better round is answer 2's
design round, and F1's links show listings), K23 (PoB rebuilds every known socketable's lines from data; text lines
would be scaled twice) and K53 (every rule the checker emits is a `fail('<rule>'` literal); and the parts the verifiers
refuted: K6's `--pin` and `vendor/`, K29's unique keys, K35's PoE1 root, K38's 176-file tree edit,
K40's step 2, K41's PG-106 judgment item, K44's M-30 serialization, K47's merge date, K48's move of PG-113, K54's
slices-after-the-build, K55's state-folder and allow-list items.

Cost: surveys 1.23M, the draft 0.52M, lenses 1.52M, clustering 0.20M, verifiers 0.84M, the fold 0.58M, the
consistency pass 0.32M subagent tokens: about 5.2M in all, about 2.7M of it the review.

**The consistency pass** (a fresh agent, on the fold): every material cluster's fix checked in place, five found missing
or half-applied and added (K5, K20, K25, K44, K55); 23 inconsistencies the fold made, fixed (11 sections that
contradicted another, 7 citations, the real case's plan group numbers and CullTheConquerer read as an early-endgame
character, not a campaign case). Left to the coordinator, and settled: choice A's line stays level 65, the first
waystone tier's area level (`m` is measured at 69, D-281, a rung's stage, not where the endgame starts); game
knowledge reads only committed digests (§19).

# Appendix A. Formats

### A.1 A digest's league dates

The homepage card the script reads (poe2db.tw/us/, saved 2026-11-07), one per league:

```html
<h5 class="card-header">Forbidden Rites <small class="float-end">0.5.5</small></h5>
  <div data-displaytime='1788552000'></div><div><a href="Version_0.5.5">Running for</a></div>
  <div data-displaytime='1797019200'></div><div>Ends in</div>
```

The line 3 it writes (the sentence after the fetch date):

```
Forbidden Rites (0.5.5) on poe2db.tw, fetched 2026-11-07. League: from 2026-09-04 20:00 UTC until 2026-12-11 20:00 UTC. In-pin flags: checked against the PoB2 pin v0.23.1 on 2026-11-07.
```

With no end on its card: `League: from <start> UTC until no end announced.` Instants are written in UTC, to the minute.

### A.2 The task header (changes)

| Field | Value |
|---|---|
| `digests` | new: the running digests' paths, newest first (root-relative, or absolute for a user-side digest) |
| `scope` | new values for D1's steps: `"better"` (§17), `"ladder"` (§18) |
| `source` | new, for W1 in a writer run: the source run folder, relative to the guides root, and its build id when it has `builds/` |

### A.3 A patch entry

```lua
{
  pg = 'PG-106',
  fingerprints = {
    { file = 'Classes/SkillsTab.lua',
      func = 'function SkillsTabClass:UpdateGlobalGemCountAssignments()',
      sha1 = '<manifestSha1 of the function>' },
  },
  test = { file = 'tests/integration/pg106.test.ts', case = '<the "bug still present" case\'s title>' },
  apply = function() … end,
  revert = function() … end,
}
```

A data entry in `ParseFixes.lua` adds `fingerprints = { { file = 'Data/ModCache.lua', line = 'c["<the line>"]=', sha1 =
'…' } }`; a line range is `{ file = 'Modules/CalcSetup.lua', from = '<its first line's text>', to = '<its last line's
text>', sha1 = '…' }`.

### A.4 `pin-upgrade-report.json`

The values are illustrative.


```json
{
  "from": {"tag": "v0.23.1", "commit": "…"}, "to": {"tag": "v<n>", "commit": "…", "version": "…"},
  "done": ["pin", "fetch", "probe", "fingerprints", "skillSlotMethod", "gate", "rulesIndex", "reflag"],
  "judgment": [
    {"kind": "golden", "test": "tests/integration/golden.test.ts", "stat": "Life", "old": 2977, "new": 3010},
    {"kind": "symbol", "symbol": "skillsTab:ProcessSocketGroup", "change": "body"},
    {"kind": "fingerprint", "pg": "PG-109", "file": "Classes/ItemsTab.lua", "func": "function ItemsTabClass:Load(xml, dbFileName)"},
    {"kind": "reread", "file": "pob-api/API/Trade.lua", "lines": "640-669"},
    {"kind": "treeVersion", "old": "0_5", "new": "…"},
    {"kind": "rulesIndex", "candidates": "<path>"},
    {"kind": "digestFlags", "digest": "runes-of-aldur.md", "changed": 12}
  ],
  "retired": [{"pg": "PG-106", "removed": ["pob-api/API/Patches.lua entry", "tests/integration/pg106.test.ts: its retirement test"]}],
  "failed": null
}
```

### A.5 Plan schema 11 (the additions)

- `stages[].source`: `{kind: "builds-folder" | "import-code", name?, sha1, loadout}`, on a read stage only.
- `stages[].items.slots[]` and `items.treeJewels[]`: `owned: true`, `standIn: true` (both optional, the reader's only).
- `stages[].skills.groups[]`: `owned: true`; `switch: {when: string, off: number[]}` (with `enabled: false`).
- `stages[].skills.granted[]`: `{skill: string, quality: 0..20}`.
- `stages[].config.file`: `{<PoB input name>: string | number | boolean}`, written as set, its custom modifiers among
  them; on a read stage `config.earned` is empty and `config.scenario` holds only `enemyIsBoss`, from the file.
- A read stage: id `f`, `progress: "endgame"`, no `variant` until placed; placing renames it to its rung's id and adds
  `variant`, `ascendancyPoints` and `variantBasis`.

### A.6 A piece run's log and folder

```json
{"schemaVersion": 4, "skillRevision": 16, "piece": "compile", "runFolder": "<absolute>/compile/2026-12-01-1", "status": "running",
 "mode": "online", "testConfig": null, "noNinja": false, "pinCommit": "…", "digest": ["forbidden-rites.md", "runes-of-aldur.md"],
 "source": {"kind": "builds-folder", "name": "ResurrectForbidden", "sha1": "…"},
 "stages": [], "checkpoints": [], "displays": [], "escalations": [], "faults": [], "resumes": [],
 "pricing": {"stops": [], "retries": []}}
```

| Piece | Steps it logs | Its files, at the folder's root |
|---|---|---|
| `compile` | `read`, `measure`; with the better round `place`, `D1-build`, `D1-tree`, `D1-finish`, `D1-gate`, `F1` | `run-log.json`, `source.xml`, `plan.json`, `read.json`, `measure.md`, `compile-record.json`, `compiled-build.xml`, `cards/file.md`, `pieces.md`, `trades.json`, `trade-links.json`, `reports/gates/`, `interviews/` |
| `pricing` | `read`, `price` | `run-log.json`, `source.xml`, `plan.json`, `read.json`, `compile-record.json`, `compiled-build.xml`, `prices.md`, `upgrades.json` |
| `writer` | `W1` | `run-log.json`, `guide.md`, `audit.md`, `notes.txt` |

A file run's brief (`/pob2:build-guide`, C-51) adds `from` (a builds-folder name, or `"import code"`) and `better`
(boolean); its slug is `file`.

### A.7 `plan_from_build`

Input: `{run_folder: string, build_name?: string, import_code?: string, loadout?: string, tree?: "newest" | "stop",
main_group?: number, buffs_on?: number[], buffs_swap?: number[], stand_in?: {<slot>: string | "plain base"}}`: on the
first call exactly one of `build_name` and `import_code` and no answer; on the second, answers only. Group numbers are
the plan's.

Reply (text): `Read <name> (<loadout>) into <run_folder>/plan.json: stage f, level <n>, <k> items (<m> owned), <g>
groups.`, then `Left out:` lines, then `Questions:` lines, each naming its answer field and the plan's and file's values.

`read.json` (the values are illustrative):

```json
{"source": {"kind": "builds-folder", "name": "…", "sha1": "…", "copy": "source.xml"}, "treeVersion": "0_5",
 "loadouts": ["…"], "loadout": "…", "groups": [{"plan": 3, "file": 6}],
 "left": [{"slot": "Weapon 1", "text": "…", "reason": "base Runemastered Long Quarterstaff isn't in the pin"}],
 "dropped": [{"fileGroup": 3, "skill": "Spear Throw", "reason": "a copy of a granted skill with no support, at its group's level 1"}],
 "levels": [{"skill": "Virtuous Barrier", "copy": 20, "granted": 1}],
 "questions": [{"field": "main_group", "planValue": 11, "fileValue": 14, "note": "PoB's choice, possibly its guess", "groups": ["…"]}],
 "notRead": ["notes", "party", "tradeWeights", "timelessData"], "importLeague": "Forbidden Rites", "answers": {}}
```

`importLeague` is there only when the file's `<Import>` has a `lastLeague`.

### A.8 The record (the additions)

`stages.<id>.owned: [<slot>…]`; `stages.<id>.switches: [{group, off, spiritUnreserved, keyFigures}]`;
`stages.<id>.overlay: [<item name>…]`.

### A.9 A switched buff in the guide

`- Purity of Ice: switch it on for bosses; switch Herald of Ice off for it.`

### A.10 `upgrades.json`

The values are illustrative.


```json
{"budget": {"divines": 50}, "league": "Forbidden Rites", "checked": "2026-12-01T18:00:00Z",
 "slots": [{"slot": "Helmet", "listings": [{"price": {"amount": 12, "currency": "divine"}, "gain": {"fullDps": 0.08,
 "ehp": 0.02, "maxHit": {"type": "Cold", "change": 120}}, "link": "https://…"}]}],
 "chosen": [{"slot": "Helmet", "listing": 0}], "spent": 12}
```

`chosen` holds the user's picks at the display, `spent` their total.

### A.11 An overlay sidecar

The entry is Forbidden Rites' first soul core (`data/league/forbidden-rites.md`:17–27); the unique is a placeholder.
`statOrder` is the in-pin line's number when the stripped text matches one, else a fresh number above the pin's largest.


```json
{"schemaVersion": 1, "league": "Forbidden Rites", "fetched": "2026-11-07",
 "socketables": [{"name": "Jiquani's Soul Core of Automation", "type": "SoulCore", "rank": [50], "socketBound": false,
   "slots": [{"label": "Weapon", "keys": ["<from rune-slots.json>"], "lines": ["+1 to Level of all Totem Skill Gems"],
     "statOrder": [<n>]}]}],
 "uniques": [{"name": "…", "base": "Two-Stone Ring", "level": 52, "implicits": ["…"], "explicits": ["+(12-16)% to …"]}],
 "skipped": [{"name": "…", "reason": "label '<a label rune-slots.json lacks>' has no PoB key"}]}
```
