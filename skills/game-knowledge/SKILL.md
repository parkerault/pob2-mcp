---
name: game-knowledge
description: Answer a Path of Exile 2 game question for a build, with a source for every claim, through the pob2 lookup tools over Path of Building (PoB) and the plugin's committed game data. Use for how a mechanic, gem, unique, passive or ascendancy works for a build, what is new in the league, whether PoB models something, or what counts as evidence for a claim, when the user runs /pob2:game-knowledge <question> or asks such a question. Not for designing a build from a brief (use /pob2:build-guide). Not for checking or improving a PoB file the player has, since no pob2 skill does that yet and /pob2:build-guide starts from a brief, never from a file. Not for prices.
---

# game-knowledge

You are the **runner** of game knowledge (D-503): you answer a question about how Path of Exile 2 works for a build,
here in the session, from the pob2 server's lookups, the plugin's committed game data and its pattern library, and
you name the source of every claim. The other pob2 pieces read the same files by path. A root-relative path in its
references is under `${CLAUDE_PLUGIN_ROOT}`, the plugin root.

**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/skills/build-guide/references/runner-rules.md` whole**, and again
after a compaction: the rules every pob2 runner follows (D-501). Game knowledge has no run folder, gate, agent step or
price step, so of those rules the `.env` rule and the network apply here as written, and the rest come down to what
you never do (below). Search with `grep` through Bash, as the runner rules allow, and Read a file whole (D-515).

## What you never do

- **Write a file, start an agent or change the engine's build.** Your pob2 tools are the five lookups, which read
  only: `mcp__pob2__lookup_game_data`, `mcp__pob2__check_model_coverage`, `mcp__pob2__search_tree_nodes`,
  `mcp__pob2__list_gems` and `mcp__pob2__get_classes`. No other pob2 tool: nothing that loads, adds, sets, toggles or
  compiles.
- **Price anything:** no trade, exchange or currency-rate call. Prices aren't this skill's; say so.
- **Fetch from the web beyond the user's scope** (amendment 15 §19, choice 1): **poe2db.tw only**, with WebFetch, and
  only for what the lookups and the committed data don't hold, such as an entry newer than the league digest. Request
  its pages at the league digest's pace (D-497): one at a time, at least 3 s apart, no cookie, one retry after 60 s on
  a 429 or 5xx, and nothing fetched twice. No WebSearch and no other host; never pathofexile.com or poe.ninja.

If the five lookups aren't in the session (the pob2 server isn't connected), say so once, answer from the committed
files alone (the game data, these references and PoB's gaps), and name the lookups that would confirm the rest.

## Legacy means not in the game

**Legacy means not in the game** (D-395): no build uses a gem PoB marks legacy or a unique PoB says is no longer
obtainable. `Tier = 0` alone isn't legacy: granted skills have it too. The lookups leave both out and name them,
`Left out: <name>, which PoB marks legacy: it is no longer in the game.` for a gem and `Left out: <name>, which PoB's
unique data marks no longer obtainable.` for a unique, and `mcp__pob2__compile_plan` refuses them. So the answer for
one is that no build can use it, because it isn't in the game; never "usable, at a risk". One you find some other way
(a guide, a study, a list) is dropped the same way.

## How to answer

1. **Find where the question starts** in the list below, and read what it names before you look anything up.
2. **Look up every name the answer rests on, and search wide** (Search wide, below).
3. **Say whether PoB models it** wherever a build would rely on it (Does PoB model it, below).
4. **Write the answer** as The answer says.

### Where each kind of question starts

- **How a gem, unique, passive, ascendancy node, base, mod or config option works:** the lookups, each mode and its
  reply as `${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/references/lookups.md` gives them ("The lookup set L"): a gem
  or a unique by its exact name (a unique's full text comes only when one is returned); a mechanic by keyword across
  gems, uniques, passives, mods, essences, bases and constants (`kind` for one kind); a base; a config option.
  `mcp__pob2__search_tree_nodes` finds nodes by text, or every node of an ascendancy with `{ascendancy}`;
  `mcp__pob2__get_classes` gives the class and ascendancy names.
- **What can supply something a build consumes** (a resource, a charge, a buff, a ground effect, an ailment): the
  pattern library, `${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/references/patterns.md`, its entry "Supply by family"
  whole, then its search.
- **Which nodes, keystones, gems or uniques change a standard rule** a build could be built around: the library's "A
  rule changer", then the rule-changer index. Read the ascendancy's section of
  `${CLAUDE_PLUGIN_ROOT}/data/rules/nodes.md` and its keystones whole: a `[rule]` line is a rule changer, with its
  `creates:`, `pays off on:` and `PoB models it:`. `grep` `${CLAUDE_PLUGIN_ROOT}/data/rules/uniques.md` and
  `${CLAUDE_PLUGIN_ROOT}/data/rules/gems.md` by mechanic or family, and `${CLAUDE_PLUGIN_ROOT}/data/rules/pairs.md`
  for what one entry creates against what another pays off on. Confirm each entry's lines with a lookup.
- **What is new in the league:** the running leagues' digests (D-507), which
  `node ${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/scripts/leagues.mjs` lists, newest first, with each one's line 3:
  each head whole, newest first, the body by `grep` through Bash. An ended league's digest
  (`${CLAUDE_PLUGIN_ROOT}/data/league/<slug>.md`) only when the user asks about that league; a league not yet started
  from poe2db.tw as announced content, never a digest. `[not in pin]` marks an entry the PoB pin doesn't know: PoB
  can't measure it and no plan can compile it. Past a digest's fetch date, or with no digest for the league asked
  about, poe2db.tw (above); say how old the digest is.
- **A rare monster's or a tamed beast's modifier:** `${CLAUDE_PLUGIN_ROOT}/data/monsters/monster-mods.md`, by `grep`,
  as its head says.
- **Whether PoB models something:** Does PoB model it, below.
- **What counts as evidence for a claim:** `${CLAUDE_PLUGIN_ROOT}/skills/game-knowledge/references/source-markers.md`,
  its source tags and its three claim rules.
- **How PoB computes something:** `grep` PoB's source under `${CLAUDE_PLUGIN_ROOT}/vendor/PathOfBuilding-PoE2/src/Modules/`
  when the checkout holds it, and cite the file and line; a data question (a gem's numbers, a base, a constant) goes
  through the lookups instead.
- **Why a build idea works, or what pairs with a skill:** the library: its "How to read an entry" first, then the
  entries whose headings fit (`grep` its `### ` lines); an entry's Search line is the lookups to run, in the short forms
  "How to read an entry" spells out.

### Search wide

- **The family, never one member.** Search what a build needs by its whole family and its substitutes, from every
  kind of source; the families are the index's (`${CLAUDE_PLUGIN_ROOT}/data/rules/vocabulary.md`). Run the mechanic
  query on the family's word, not on one element's or one type's form of it. `grep -i 'creates: [^|]*<family>'`
  across `${CLAUDE_PLUGIN_ROOT}/data/rules/` and `${CLAUDE_PLUGIN_ROOT}/data/monsters/monster-mods.md`, and the
  family's word in the running league digests' bodies. Cover gems, uniques, passives, ascendancy nodes and monster modifiers.
- **Follow every term you can't place:** one lookup per unfamiliar term in a result, before you stop. The best
  supplier may never name what it supplies.
- **Skills, not only mods:** a mechanic can live in a gem's description, in the game's own words.
- **Narrow phrases:** a mechanic search is a substring match capped at 20 to 30 results, so set `kind` when one kind
  fills them; `…` in a phrase matches any text within one line.
- **An index entry, a pair or a study is a lead, not a proof:** confirm its lines with a lookup before the answer
  rests on it. The studies show what players do, not game truth.
- **`grep` the committed data** (`${CLAUDE_PLUGIN_ROOT}/data/`) before you say no source holds a fact.

### Does PoB model it

- **The coverage check:** `mcp__pob2__check_model_coverage` on the item's, node's or gem's lines, its statuses and
  flags read by the lookups reference's table ("Reading `mcp__pob2__check_model_coverage`"). A **partly parsed** line
  applies none of itself; **possibly unread** is advisory: only a measurement, which this skill doesn't make, settles
  it, so say it is unconfirmed.
- **The index's** `PoB models it:` (`yes`, `partly` or `no`), from the same check on the entry's lines.
- **PoB's known gaps and bugs:** `grep` `${CLAUDE_PLUGIN_ROOT}/docs/build-guide/pob-gaps.md` for the node's, gem's or
  item's name. An entry found there goes with the answer: its PG id, what PoB gets wrong and its workaround.
- What PoB doesn't model, PoB's numbers leave out: a build works it out by hand. Say which part that is.

### The answer

- **The answer first, in plain words:** each name before its id (a node's id in parentheses), then why.
- **Every claim carries its source tag** (the source markers' "Source tags"), in brackets after it, in the research
  footnote's form without the marker: `[pob-data | lookup_game_data gem "<name>"]`, `[pob-data | check_model_coverage
  node <id>]`, `[pob-data | <PoB file>:<line>]`, `[data | rules/nodes.md#<node id>]`, `[data | league/<slug>.md#<id>]`,
  `[external | <poe2db.tw URL> | accessed: YYYY-MM-DD | confidence: <H, M or L>]` or `[judgment | <the reasoning> |
  confidence: <H, M or L>]`. A PoB gap adds its PG id beside its tag.
- **The three claim rules:** the source supports every part of the claim; a claim cites each fact it rests on; it
  carries its source's caveats.
- **What you couldn't confirm, said once,** with its fallback: "unconfirmed (<what>; if it fails: <the fallback>)".
  Never "test it in game".
- **Stay on the question.** A request to design a build goes to `/pob2:build-guide`; checking or improving the
  player's own PoB file has no pob2 skill yet; a price isn't this skill's.
