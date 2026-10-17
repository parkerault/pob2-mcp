# The Varashta baseline run: the user's feedback

**Status:** collecting during the run (run folder `disciple-of-varashta-navira-s-fracturing/2026-10-17-1`, in
`/home/parker/projects/pob2-mcp-runs/m16-varashta/guides/`). The user asked for one amendment that folds in all of
this file once the run is finished (2026-10-17). Each section is one gate or stage, in the order the run reached it.

## 1. The brainstorm gate, visit 1

**What the user saw:** the brief, then eight dealt cards and one "Not dealt", one line each. A typical line:

> r1-b-1 "Leer Cast and Yix buff the djinn as an ally" | Sorceress Disciple of Varashta, Navira's Fracturing (cast
> by Navira, the Last Mirage, summoned by Navira, the Last Mirage) | minion, combo, balanced, steady | links
> confirmed 8 of 8 | evidence: no player evidence

**The user's points:**

- "The presentation of the cards leaves a lot to be desired. A human looking at this wall of text is going to have
  more questions than answers. We need to consider what information the player is looking for in order to make
  their decisions."
- "This step is a pitch, so tell the user why they might want to pick it. If the cards already contain that
  information, it should be summarized for the user."
- "When I first encountered it, what I really wanted wasn't 'this one', it was 'this one, but...'."

**What the coordinator found:**

- **The cards hold most of what a player needs.** `r1-b-1`'s Pitch says how it kills, its Enabler says when the
  items arrive (levels 16 and 24), and its Risks give the catches. The display keeps only the title and the playstyle
  tags.
- **The tags have no labels.** The five axes are delivery, buttons, focus, defence and pace (`card-template.md:38`),
  so "balanced, balanced" is focus and defence.
- **Two things repeat on every line:** the identity (nine times) and "no player evidence" (eight times).
- **The deck's shape is hidden.** Five of the eight cards are one loop with a different add-on: Frost Bomb, then Ice
  Nova lays Chilled Ground, then Navira's Fracturing shatters it, and Frost Nexus keeps the ground coming once
  enemies freeze. R1a-assemble knew this; it dropped `r1-a-2` as a duplicate for it.
- **No card says why to pick it or how it differs from the others.** The titles name a mechanism, not a hook.
- **A pick can't carry a change.** The gate (`checkpoints.md`, "The brainstorm gate") takes 1–3 card ids or
  "brainstorm more" with a note. Free text can only name another card id.

**The agreed direction:**

- **A deck header first:** the shared core once, in player terms. Then each card shows only what it adds.
- **Each card is a pitch:**
  - **a human-friendly name in place of the card id** (the user's nitpick 2). Ids stay internal, in the run log and
    the run folder;
  - **why pick it:** the hook, in player terms;
  - **how it plays:** buttons, pace, and packs or bosses, in words, not unlabelled tags;
  - **what it needs and when it comes online;**
  - **the catch.**
- **Confidence in plain words, and only where it differs between cards.** Say "not confirmed in game", not "no
  player has tried any yet" (the user's nitpick 1). The vanilla combo, Frost Bomb, Ice Nova, then Navira, is obvious
  from the skill descriptions, so the second phrasing reads oddly.
- **An interview, not a multiple choice** (the user's nitpick 3). The user, on the coordinator's case for multiple
  choice (fixed answers for offline tests, a bounded runner context, fixed logging):

  > I understand your reasons for multiple choice, but I'm fairly certain that the user is going to have questions
  > 99% of the time. The cards are abstracting away an ocean of gameplay mechanics, and making it multiple choice
  > means the user either has to go do research before answering, or make uneducated selections and hope the agent
  > knows what's best (unlikely in this domain). If it makes testing more complex, I'd rather sacrifice that than
  > good UX.

  - The runner answers the user's questions before anything is chosen.
  - A choice may carry changes ("this one, but…") or combine cards. The change travels with the pick to R1b, which
    revises the card and re-checks the links the change touches before it builds the skeleton.
  - Offline test mode still has to answer the gate somehow. The user accepts a more complex test setup for this.

**Open questions for the amendment:**

- **How far the runner may go to answer a question.** It might read only the cards and research, also use the
  lookup tools, or also start a research agent. The user's point is that the alternative is the user researching it
  themselves.
- **The card names:** unique within a run, stable across rounds, and how the user refers to them in an answer.
- **How an interview ends and what's recorded:** the decision in a fixed form for the run log, plus the change notes
  that travel with it.
- **The test config for an interview gate.**
- **Whether the other gates (verification, design, final) become interviews too.** The rest of this run will show.

**For the comparison with Navira's guide:** the round-1 deck's low variety (five of eight on one loop) belongs to the
engine-lens amendment as much as to this one.

## 2. The verification gate, visit 1

The run paused here on a compiler bug: compile_plan measured PoB's own tree-granted Navira group instead of the plan's.
That is a defect, not feedback, and its fix has its own work-log section. The points below are the user's feedback on
the candidates the gate showed.

### 2.1 Legacy gems are not allowed

**The user:** "Two of the build candidates used the Commandment skill marked 'legacy' in PoB, which isn't in the game
anymore. Anything marked 'legacy' isn't allowed in the build."

**What the coordinator found:**

- **How PoB marks legacy.** The skill's effect has `legacy = true` (`Data/Skills/sup_int.lua:2045` for Commandment).
  PoB's skills tab hides such gems unless "Show legacy gems" is ticked (`Classes/SkillsTab.lua:92`, `:152`;
  `Classes/GemSelectControl.lua:105-115`). At the pin, eight skills carry the flag: Murderous Intent, Overextend,
  Bloodlust, Infernal Legion III, Lasting Ground, Undermine, Commandment and Shock Conduction II.
- **PoB's gem `Tier = 0` is a different thing.** Ascendancy- and item-granted skills have it too, Powered by Verisium
  among them, so it must not be read as legacy.
- **Our tools don't show the flag.** Only `suggest_supports` leaves legacy gems out (`pob-api/API/BuildOps.lua:2154`).
  `lookup_game_data` shows them without a mark, and `compile_plan` accepts them.
- **The run used Commandment everywhere.** It is in 13 of the 18 cards and in all three picked skeletons' plans. Lasting
  Ground is in `r1-a-2`.
- **Two R1b agents (the stage that compiles a concept skeleton) found the flag** by reading PoB's Lua
  (`sup_int.lua:2045`). They kept the gem and wrote a risk: "PoB's data marks the gem legacy (tier 0), so it may not
  drop in the current league" (`concepts/r2-c-1/plan.json`, `concepts/r2-c-3/plan.json`). Nothing told them that legacy
  means not in the game. They also took `Tier = 0` for part of the mark. `r2-c-2`'s plan uses the gem with no note.
- **The cards' figures include it.** Commandment gives 100% increased command cooldown recovery, which the cards count
  as a large part of Navira's rate. Without it, every figure that rests on the rate is high.

**For the amendment:**

- **Hide legacy gems from the lookups by default**, as unique mode already skips legacy "Pre x.y" variants.
- **`compile_plan` refuses a legacy gem**, so a plan can't carry one whatever the lookups showed.
- **One line in the skill:** legacy means not in the game, so it isn't allowed.

### 2.2 Powered by Verisium was missed

**The user:** "There's a skill called 'powered by verisium' that generates elemental infusions that can be used by any
skill. It's extremely powerful and would be a cornerstone of a build that relies on ice nova to generate frozen ground
for Navira. None of the designers found it, so I want to figure out why. It may be newer than PoB's data set."

**What the coordinator found:**

- **It isn't newer than PoB's data.** It is in the pin (`Data/Gems.lua:19762`, `Data/Skills/other.lua:12739`): "Spends
  Ward to generate Verisium Infusions, which can be used in place of any Elemental Infusions". At level 1 it
  "Generates 4 Verisium Infusions" on a 7 s cooldown for 20 Runic Ward. At level 20 the cooldown is 5.1 s and the cost
  155 Runic Ward. So the build needs a Runic Ward source, such as the "Verisium" item prefixes in `Data/ModItem.lua`.
- **Our lookup finds it.** `lookup_game_data` mechanic "Infusion" (kind gem) and mechanic "Elemental Infusion" both list
  it.
- **The researchers searched for the specific resource.** Across the run's agents, every infusion lookup was mechanic
  "Cold Infusion" (five times, two of them kind gem) or "Infusion Remnant" (twice). The substitution is written only in Powered by Verisium's own
  description ("in place of any Elemental Infusions"), which doesn't contain the words "Cold Infusion".
- **Two researchers saw a clue and didn't follow it.** Round 1's researcher a and round 2's researcher b got Runic
  Extraction's line in their "Infusion Remnant" results: "Supported Skills have 35% chance create a Verisium Infusion
  Remnant on kill". Neither asked what a Verisium Infusion is.
- **Every R1a agent had the name, and only the name.** "Powered by Verisium" appears in each research transcript in a
  long list of skill names, with no description.
- **The miss is in the method, not the data.** When a chain consumes a resource, the supply search has to cover the
  resource's whole class ("Infusion", "Elemental Infusion") and the class's substitutes, not just the resource's own
  name. An unfamiliar term in a result ("Verisium Infusion") is a lead to follow.

**For the engine-lens amendment** (with the tamed-beast miss): a library entry and a researcher-brief rule for the
supply search. Navira's build is the example for both: the beast's Frozen Ground Trail and Powered by Verisium are both
supplies of the ground the engine needs.

## 3. The tool's users: a brainstorm, not an instruction

**The user, after the verification gate** (lightly trimmed):

> While using the tool, it occurred to me that we've designed it for a very narrow use case; provide some basic inputs
> and have the skill spit out a build guide at the end. In reality, there are several different ways a user could use
> the tool. This is just a brainstorm, not an instruction.

The user's list of users:

1. A novice with little or no game knowledge. This is the closest to the current workflow, and of questionable value,
   since that player can follow someone else's guide.
2. An intermediate player who knows the core build they want, and needs help finding non-obvious synergies.
3. A variant of 2: a player with an in-game character, exported to PoB2, who wants to improve it.
4. An advanced player who knows the "pro tips", wants to explore options, and wants the labour of editing PoB2 builds
   offloaded.
5. A guide author with a finished endgame build, who wants the character's progression, its PoB2 loadouts and the guide
   written for them.
6. A variant of 5: a player with only an endgame PoB2 file, for example from poe.ninja, who wants a guide for their own
   use.
7. A player who wants to customise a community build: change the gameplay they dislike, or make it work on cheaper
   gear.

> This is not an exhaustive list, but illustrates the need for flexibility. Some users will want an assistant with
> expert game knowledge, and some users will just want a tool that produces builds. Maybe we should consider decoupling
> the expert from the build pipeline. Regardless, the way I started work on the tool is to blame; I said I wanted to give
> it an ascendency and skill and generate a build guide. In practice, a completely hands-free build generator isn't
> practical. It would be nice if the user doesn't have to know anything about the game, or doesn't have to do any of
> their own research, but without a 100% complete and accurate PoE2 encyclopedia, unattended agents will never be able
> to produce an optimal build.

The discussion that follows is recorded here once the user has answered it.
