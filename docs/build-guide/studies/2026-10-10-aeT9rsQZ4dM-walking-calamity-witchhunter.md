# Random build: Walking Calamity Witchhunter (Schwingy, 0.4)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/random-brief.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

HEADER
- Video: aeT9rsQZ4dM, "This Might Be The Luckiest Random Build Ever... (POE 2 Movie)" (Schwingy, uploaded 2026-01-07, 1:01:45).
- Game: Path of Exile 2. The evidence is the Mercenary/Witchhunter class, Druid bear skills on a talisman, the Arbiter of Ash and Atziri.
- Patch: 0.4.x, filmed at the start of the Fate of the Vaal league. PoB's data has a "Pre 0.5.0" variant of The Brass Dome, so at least one key value has changed since then. Don't treat its numbers as current.
- Roll: Witchhunter with Walking Calamity, a bear-form "ultimate" that unlocks at level 52.
  - It casts only at maximum Glory.
  - Glory builds when you gain Rage while already at maximum Rage. PoB's text confirms this.
- Rules: zero to hero on a fresh league character, with trade allowed. Two goals: kill the Arbiter of Ash, and kill Atziri.
- Outcome: he finished the campaign, mapped to tier 15, cleared all three citadels, and killed the Arbiter (after many attempts) and Atziri (on the second attempt). He reached level 92 in about 39 hours.
- Verdict: "the most fun random build run" so far, and very tanky. Much of the endgame power was bought with two lucky sales (8 and 21 divines).

THE ARC
- 01:14–01:33: The payoff is locked until level 52. He bridges with bear attacks on the same talisman (Maul, Furious Slam, Fury of the Mountain) plus Volcano. His "loose" tree plan is the two-handed nodes first, then the warrior side for rage, fire and armour.
- 11:09–18:19: The tree pre-buys the payoff's scaling. He takes rage-to-fire damage, rage generation, and a node that makes armour break (applied by the physical bear hits) raise the enemy's fire damage taken.
- 22:16: Calamity comes online. He learns that Glory is made from rage overflow, and uptime is only partial.
- 23:42: Discovery: Ferocious Roar with the Raging Cry support, used next to a boss, gives full Glory at once.
- 25:34–26:20: He adds Ngamahu's Chosen (a charm that grants max rage) and the Fireflower amulet (deals fire damage to you when you ignite) to build rage.
- 26:32–27:42: Eternal Rage, a spirit gem that generates rage passively, is unaffordable. He fixes it by buying strength boots and cutting two idle spirit gems. Calamity is now almost always ready.
- 30:49–41:00: He cuts two supports, Hourglass and Rapid Attacks.
- 41:04–42:45: Bhatair's Vengeance, a support that grants a cold-damage buff when it freezes, won't proc. After a hunt for a skill that freezes reliably, he lands on Lunar Assault.
- 45:21–55:02: The Sorcery Ward ascendancy shield, then The Brass Dome and the Heart of the Well jewel to grow it.
- Final setup: the Fury of the King talisman, Bhatair's moved onto Molten Crash, a corrupted 21/20 Calamity gem, and Rakiate's Flow replacing Fire Penetration (53:12–1:00:19).

THE PROCESS (new or sharper heuristics only)
1. Pick a generator whose output peaks when you need the payoff (22:16–23:55). Glory needs rage gained past the cap. Raging Cry grants rage "depending on counted monster Power" (PoB text), so its biggest refill comes in front of a boss, exactly when the burst matters. This sharpens the staged handover (the payoff stays a burst until supply grows): choose the burst source by how it scales with the fight.
2. Read the payoff's tags to find which +level sources apply (26:00–26:20). Calamity is an attack with no melee, projectile or spell tag, so the usual amulet mods are dead. Only "+level of fire skills" applies, and Fireflower carried it. PoB data agrees: the skill types are Attack/Buff/Duration/Shapeshift/Bear/Area/Fire, and Fireflower has +(1–4) to all Fire skills.
3. Check which phase each support touches (30:49–31:24, 40:45–41:00). Rapid Attacks sped up only the roar, not the meteors. Hourglass added a cooldown, so a stun during the roar meant 10 seconds without the main skill, and its "30% more" possibly didn't apply. Rule: a support has to scale the payload, and you price the worst case of an interrupted cast.
4. When a condition won't trigger, climb a ladder ordered by cost (41:29–42:45).
   - Add supports to the existing skill (Embitter, Freeze, Cold Attunement, even sacrificing the Rage support).
   - Try a harder hitter (Furious Slam).
   - Stop and list candidates by how much the build must change. He rejected Fangs of Frost because it needs a new spear and a tree change.
   - Search same-weapon, same-class skills for a built-in multiplier. Lunar Assault has "436% more freeze buildup" on a talisman, confirmed in PoB at gem level 15.
   - Verify by the visible buff icon, not by feel.
   - Later he consolidated onto Molten Crash to save a button (55:26). He admitted it doesn't freeze bosses, so it is a clear-speed buff (42:49).
5. Re-price an enabler when something else covers its job (43:34–43:44). Once Eternal Rage made rage passive, Fireflower's rage role was gone. Its +3 levels then lost to a spirit amulet that funded Vitality and Cannibalism.
6. When a defence is sized from another stat, accept the loss and then stack that stat at its largest base (45:33–46:22, 53:57–55:02). Sorcery Ward costs 30% of armour. The Brass Dome plus the Heart of the Well jewel ("increased armour from equipped body armour") took the shield from about 2,570 to 5,844 (frames at 54:47 and 54:53). Afterwards he ran 6-mod maps.
7. For one-attempt high-value content, strip optional difficulty to keep your revives (38:05–38:09, 47:33). This sharpens "read encounter mods as a damage check".

Diagnosis was mostly covered by earlier heuristics:
- A fire-resistant boss was his longest fight (25:15), and he slotted Fire Penetration for it (38:40).
- The bear hitbox was too big for the Arbiter's dodge phases, so he switched to human form (50:30). PoB's text says Calamity is paused, not lost, outside bear form, which he never checked.

PATTERNS
New:
- Overflow resource: a resource that fills only while another one is capped. Search step: grep skill text for "while already at maximum", then rank sources by gain rate. There is an unexplored tension: a lower max rage overflows sooner, but rage also scales fire damage here. He swapped to a talisman with less max rage (18:57) without discussing it.
- Threat-scaled generator: a resource gain that grows with enemy power. Search step: grep for "counted monster Power" or "based on nearby enemies".
- Condition carrier: an off-skill whose only job is to trigger a support's global buff (Bhatair's grants the buff to "you and allies" on freeze). Search step: find supports that grant a buff on an ailment, then rank same-weapon skills by their built-in buildup multiplier.
- Defence that scales defence: a layer sized from another defence stat (Sorcery Ward from armour). Search step: ascendancy text like "% of armour as…", then the uniques with the largest base of that stat and jewels that multiply it.

Mapped to existing names:
- Fireflower with Ngamahu's Chosen: inputs-and-outputs. This link is UNVERIFIED. The charm fires on "Fire damage from a Hit", nothing shows that the self-damage counts as a hit, and he said "that's the theory" (25:49).
- Self-ignite fire cluster cut to 10% by Self-Immolation and One with Flame (36:13–36:31): forced condition (a lowered threshold or reservation that switches the condition on).
- Savage Fury on weapon swap for free spirit (10:00, 40:16): weapon set 2 doing a non-damage job. He suspects it's unintended, and PoB may not model it.
- Fury of the King converting 80% of bear physical damage to fire: conversion so another mechanic applies. It puts the bridge skills and the payoff on one element's scaling. Its PoB text also shows "2–5 Glory every 2 seconds", which he never mentions.

FOR OUR PHASES
- Tag audit before any gear search: list the payoff's skill types and name which +level and "increased X skills" mods can apply.
- In verification, check what each support modifies: the activation or the payload. Flag any cooldown on an interruptible cast with the length of the dead window.
- A fallback ladder for an unmet condition: supports, then a stronger existing skill, then a same-weapon skill with a built-in multiplier, then a new weapon or tree (priced). Show the user the cost of each rung.
- Show hidden clauses on cross-item links ("from a Hit", "you use yourself", "while in Bear form") to the user as theory until checked. Re-price each enabler when the supply changes.

LINKS SEEN (unopened)
pobb.in/_M6SpsSStIwx; wheelofnames.com/37h-hm9, /jjs-4ww, /88u-vfu, /gak-w8c, /9pe-sdt; patreon.com/schwingy; discord.com/invite/YXNfRXG6BB; mantasleep.pxf.io/nXGX9A (sponsor).

Notes: I used 2 of 8 frames. Name corrections from PoB data:
- "Batailleur's" is Bhatair's Vengeance. The creator says the buff lasts 20 s; PoB 0.5.4 says 15 s.
- "Namahoo's" is Ngamahu's Chosen.
- "source reward / swordquart" is Sorcery Ward.
