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
