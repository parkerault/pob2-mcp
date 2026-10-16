# Study: "SOME NERD INTERACTIONS TO IMPROVE YOUR CHARACTERS (POE2)"

- **Video:** S1AzLxb3fZw, channel 787prada, uploaded 2026-09-11, 55:55, 12 chapters.
- **Patch (inferred):** a new league has just started, so the creator replays his "Ruins of Alder" (Runes of Aldur)
  characters (00:16–00:28). The pin's data has Runes of Aldur items (Decree of Flight, `Data/Uniques/boots.lua:214`),
  so the gear and trees are 0.5.x, possibly on a newer client (not stated).
- **Kind:** a lecture-style techniques video across about ten of the creator's own geared characters, mostly on
  clear speed and movement, then on frenzy charges, defence and skill duration. Paths below are under
  `vendor/PathOfBuilding-PoE2/src/`. "Speech" means not confirmed on a frame or in data. Frames used: 10.

## Techniques

### 1. Cast on Dodge as the movement skill (03:41–07:35)

- **Chain:** Cast on Dodge's Gemling quality line adds dodge roll distance (04:18), so any Gemling dashes on
  spacebar. Data: alternate quality `cast_on_dodge_dodge_roll_distance_granted_+` 0.5 per 1%
  (`Data/Skills/act_int.lua:2304`), switched on by Advanced Thaumaturgy (`TreeData/0_5/tree.lua:47503`). There are
  two copies, from an Absent Amulet and a gem (04:08); frame 05:58 shows the amulet's "Level 20 Cast on Dodge",
  "Allocates Paragon" and "+5% to Quality of all Skills". Movement speed lengthens the roll (speech): Decree of Flight
  and Constricting Command (04:34–04:56). The socketed spell is filler, a level-1 Spark (06:55).
- **Role:** movement. A quality line turns the roll into a dash on any attack or spell build.
- **Library mapping:** Quality as a stat line; Low-level utility gems; Forced condition; new: **Travel by action**.
- **PoB:** not modelled, since travel is no PoB output.
- **Patch check:** the gem, amulet variant (`Data/Bases/amulet.lua:136`), Paragon (`tree.lua:57278`), boots and
  helmet are present; the Loreweave and Fox idol quality sources (05:44) are not found. The two copies stacking is
  speech only.

### 2. Rabid Dog companion, re-summoned on swap (07:36–11:36)

- **Chain:** catch a Rabid Dog with a haste aura in the Scorched Farmlands (08:02–09:28); it costs about 27–30
  spirit, and the aura gives about 20% attack and cast speed and 10% movement speed (09:54–10:37, speech). On the
  damage weapon set, every swap re-summons it under you, so the aura is up when damage starts and a dead dog skips
  its revive timer (10:43–11:17, speech). Frame 10:06 shows "Companion: Rabid Dog" (`Data/Spectres.lua:25785`).
- **Role:** uptime (a cheap speed aura, placed by the swap).
- **Library mapping:** Inert minions (a carrier); Weapon set 2 job. Add the swap re-summon there as an example.
- **PoB:** not established; a custom modifier would stand in for the aura.
- **Patch check:** monster present; aura values unchecked.

### 3. Attack speed as movement: Boneshatter versus Whirling Slash (11:37–18:12, 31:38–32:04)

- **Chain:** a low-level strike on its own fast weapon set (Boneshatter on a mace, Whirling Slash on a spear) moves
  you a step per swing, so attack speed is travel speed; Boneshatter covers more ground per swing (12:03–13:39).
  Speed comes from Dance with Death, "25% more Skill Speed while Off Hand is empty" (`tree.lua:47014`), the move
  set's weapon-set points (14:06), and Stimulants, "16% increased Attack Speed during any Flask Effect"
  (`tree.lua:34917`), kept on by Lavianga's Spirits, which "applies its Effect constantly" (`Data/Uniques/flask.lua:39`;
  14:25). Medved's Felling is faster with more Rage at a life cost (`Data/Skills/other.lua:11057`) that is free under
  CI (15:09–15:50). Demo: 6.76 attacks per second on a Warrior (31:53).
- **Speech only:** distance per swing (Boneshatter's text, `Data/Skills/act_str.lua:1816`, never mentions travel),
  and a doubtful Split Personality "connect, then refund" trick (17:50).
- **Role:** movement and clear speed. One cheap skill moves you; the main skill only kills.
- **Library mapping:** Weapon set 2 job (set 1 moves); Forced condition (Lavianga's); Zeroed resource (Medved's under
  CI, the HotG example); new: **Travel by action**.
- **PoB:** attack speed is modelled; travel is not. Lavianga's line is unparsed (`Data/ModCache.lua:6785`), so
  Stimulants needs the flask-active config stand-in.
- **Patch check:** all present.

### 4. Culling Strike to 100% on normal monsters (18:14–22:10)

- **Chain:** normal monsters are culled at 35% life (`Data/Misc.lua:104`). The creator's 186% increased threshold
  (19:21) gives 35 × 2.86 ≈ 100%, so any hit kills any white mob, whatever its damage (19:58–20:08).
  - **Sources:** a culling prefix on a corrupted jewel (frame 18:58: "30(15-25)% increased Culling Strike Threshold";
    the flavour text identifies Heart of the Well, `Data/FlavourText.lua:3697`). Whisper's "megalo" is unresolved.
    Also Myris Uxor, 100% (`Data/Uniques/helmet.lua:150`; "in the oxer", 19:03), and the Hunting Companion anoint,
    20% (`tree.lua:76605`).
  - **Payoff:** Killing Palm dashes to cullable targets and chains strikes between them (`act_int.lua:13824`), so a
    weak, fast skill clears and moves (20:44–21:57).
- **Role:** clear speed, and movement through Killing Palm.
- **Library mapping:** Forced condition (raise a threshold until it holds for a whole rarity); State-keyed payoffs
  (Killing Palm, Lightning Warp and Detonate Living read it).
- **PoB:** modelled as damage per second against the configured rarity (`Modules/CalcOffence.lua:3902–3910`); the
  one-shot clear is a hand calculation, 35 × (1 + increases) ≥ 100.
- **Patch check:** all present.

### 5. Wolf-pack charge engine (22:12–26:22, 51:28–52:14)

- **Chain:** Boneshatter's Minion Pact drains a wolf by 100% (I) or 150% (II) of your life
  (`Data/Skills/sup_int.lua:7012`, `7049`; 23:51) → Minion Instability explodes it at low life (23:18) → Cast on
  Minion Death (`act_int.lua:2755`) casts Profane Ritual, a power charge when the ritual ends (`act_int.lua:15986`;
  24:07) → Charge Profusion II adds "an additional Charge of a random type" (`Data/Skills/sup_dex.lua:948`; 24:21) →
  Charge Regulation turns frenzy into skill speed, power into crit, endurance into defences (`act_int.lua:3182`;
  22:28–22:44) → a faster Boneshatter drains more often. Overabundance (`sup_dex.lua:3406`) shortens the ritual;
  frame 51:59 shows "Ritual duration 0.13s", 30% chances for additional power, endurance and frenzy charges, and the
  gem setup.
- **Role:** gap closer and loop: "infinite charges forever just while you're moving" (24:39).
- **Library mapping:** Cost to a gated resource (its Bone Cage example is this drain); Closed trigger loop; Inert
  minions; new: **Charge-type converter**.
- **PoB:** Charge Regulation is modelled, with charge counts as a config stand-in. The trigger chain is not (PG-9):
  a hand calculation.
- **Cautions:** not with CI. At 1 life the drain never brings wolves to low life (36:10).
- **Patch check:** all present.

### 6. Chayula volatility detonated on yourself (26:24–31:05)

- **Chain:** volatility on you normally explodes for physical damage. Inner Turmoil, "Take no Damage from Volatility"
  (`tree.lua:54647`), cancels it (27:16). Catharsis on a cheap skill (Infernal Cry) needs 20 volatility and
  detonates a random amount (`sup_int.lua:1720–1723`; 27:26–27:55). The creator says that grants 10 s of 1% damage
  as extra chaos per volatility exploded (26:52, 30:48). Frame 29:37 shows a 188% buff with 146 volatility left, as
  he says, and his tooltip roughly doubles (30:15). Precise Volatility adds "1% increased Critical Hit chance per
  Volatility exploded" (`tree.lua:80024`), up to the crit cap (28:11–28:22).
- **Supply:** Unstable Bond, "Gain 3 Volatility when an Allied Persistent Reviving Minion is Killed"
  (`tree.lua:54144`), fed by technique 5's wolves (28:43–29:04); Instability's 25% regain (`tree.lua:96020`); on-kill
  and on-crit sources; a "Grip of Kulamok" ring (speech, 29:18).
- **Not in the pin:** the base "1% extra chaos per volatility" text (no node defines Volatile Power) and the ring.
- **Role:** damage multiplier (an about 2× burst window) and a crit gap closer.
- **Library mapping:** Drawback cancellation and offload; Burst-window stacking; new: **Harmless self-trigger**.
- **PoB:** not modelled. Precise Volatility, Instability and Unstable Bond are unparsed (`Data/ModCache.lua:6871`,
  `2260`, `5512`). A custom modifier works: extra chaos and crit chance at the expected amount exploded, with uptime
  as a hand calculation.
- **Patch check:** the nodes and gems are present, the ring is not. The library's Stacking rate caps example cites a
  0.3 Inner Turmoil; in the pin, Inner Turmoil is this node.

### 7. Ball Lightning and Lightning Warp, a pseudo-Flicker (31:09–36:36)

- **Chain:** crits or ailments trigger Ball Lightning (34:08; frame 33:26 shows it in a "Cast on C…" group).
  Stationary Primal Strikes with Minion Pact kills wolves (32:36–32:51), so Cast on Minion Death casts a level-8
  Lightning Warp, which teleports to the ball or into a cullable enemy: "Can also be used on Ball Lightning
  Projectiles" (`act_int.lua:14347`; 33:04–33:17). The stationary skill travels pack to pack (34:29); low-level gems
  and Mana Remnants keep mana up (36:21).
- **Speech only:** the warp prefers balls near enemies (34:48).
- **Role:** movement for a skill that can't move.
- **Library mapping:** Inputs and outputs (the ball is the object the warp consumes); State-keyed payoffs (cull);
  Low-level utility gems; new: **Travel by action**.
- **PoB:** not modelled (trigger rate, PG-9; travel).
- **Patch check:** all present.

### 8. Attack speed beats movement speed (36:37–37:55)

- **Chain:** faster attacks mean faster combos and travel (36:44–36:57), and a build that never sprints or rolls
  gets Unwavering Stance free: "Cannot be Light Stunned", "Cannot Dodge Roll or Sprint" (`tree.lua:47755–47761`).
  The creator calls it "total stun immunity" (37:18); the node covers light stun only.
- **Role:** movement and defence.
- **Library mapping:** Drawback cancellation and offload; **Travel by action**. It excludes technique 1.
- **PoB:** not established. **Patch check:** present.

### 9. Resonance and Armour Break for frenzy charges (37:56–40:54)

- **Chain:** Armour Break III in Twister gives a 20% chance to gain an endurance charge on fully breaking armour
  (`Data/Skills/sup_str.lua:280`; "one in five", 38:46). Resonance turns endurance charges into frenzy
  (`tree.lua:65026`), so frenzy stays up with no Combat Frenzy (38:29–39:06). That every monster's armour can be
  broken is speech (39:45).
- **Role:** gap closer (charge uptime).
- **Library mapping:** new: **Charge-type converter**.
- **PoB:** charge counts are a config stand-in; the generation rate is a hand calculation.
- **Patch check:** present. Resonance also rotates frenzy to power and power to endurance (`tree.lua:65020`).

### 10. Detonate Dead on melee hits, Smith of Kitava (40:55–43:50)

- **Chain:** Heat of the Forge grants Fire Spell on Hit (`tree.lua:60112`), which gains energy on melee hits and
  casts socketed fire spells (`other.lua:6592`). Detonate Dead is a Fire, Triggerable spell (`act_int.lua:5335`). It
  explodes a corpse for about 10–11% of the monster's life (42:11–42:20); a rare's corpse kills the pack (42:24), at
  no mana or spirit cost (41:32). Attack area nodes miss a spell, so Headhunter's generic area is used (42:51).
- **Role:** clear speed.
- **Library mapping:** Routine action as damage; Damage-source substitution (corpse life); Tag audit.
- **PoB:** config stand-in for the explosion ("Enemy Corpse Life", `Modules/ConfigOptions.lua:114`); the trigger
  rate is not modelled (PG-9).
- **Patch check:** present.

### 11. Detonate Living (43:50–45:57, 48:51–49:25)

- **Chain:** Detonate Living, "Hit an enemy under the Culling Strike Threshold, causing them to violently explode"
  (`other.lua:4523`), costs Ward (15 at level 4), from Runic Ward added to boots at the Verisium Anvil (44:25–44:41).
  It blows up a share of the corpse's life over a large area (44:46).
- **Unclear:** the creator says it fires on every monster without culling, "either bugged or…" (44:09–44:25, 48:54),
  against the gem text. Freeze and corpse consumers deny it (45:12, 49:07).
- **Role:** clear speed.
- **Library mapping:** State-keyed payoffs (cull); Damage-source substitution.
- **PoB:** not established. The "always fires" claim fails the sniff test and needs in-game testing.
- **Patch check:** present.

### 12. Runic Ward as the whole defence (45:58–48:50)

- **Chain:** Ward is a pool beneath life (46:08). Frame 46:17 shows The Brass Dome (Runeforged Champion Cuirass) with
  "Runic Ward: 2002" and "+985(750-1000) to maximum Runic Ward". Olroth's Resolve adds guard
  (`Data/Uniques/flask.lua:16`). Remnants of Kalguur (30 spirit) drops overflowing Runic Ward Remnants on stun or kill
  (`other.lua:13694`), about 265 ward each (47:21); frame 50:30 shows ward at 4,675 of 3,218. The tree's defence
  points go to damage instead (47:39–48:13), at the cost of the 60-spirit chest prefix (48:28).
- **Role:** defence layer.
- **Library mapping:** new: **Off-tree defence layer**.
- **PoB:** base ward is modelled (`Modules/CalcDefence.lua:781`); "+N to maximum Runic Ward" is partly unparsed
  (`Data/ModCache.lua:194`), so count flat ward and remnants not modelled until coverage shows otherwise.
- **Patch check:** the pin's Brass Dome (`Data/Uniques/body.lua:51`) has no ward line; runeforging (bases in
  `Data/Rares.lua:8`) may add it. Unresolved.

### 13. Duration to the floor: Spearfield and Profane Ritual (49:30–52:14)

- **Chain:** Delayed Reaction makes Spearfield's hazards trigger only on creation or expiry, at −70% duration
  (`sup_dex.lua:1834`, `1862`; 49:52). More reduction comes from Near at Hand and Forthcoming (16% each,
  `tree.lua:81878`, `116035`), small nodes (53:53), Compressed Duration, Swift Affliction and Overabundance (limit
  skills only, `sup_dex.lua:3381`). The spears then detonate on placement, 1.6 million each by the creator's count,
  several on a large hitbox (50:32–50:48, speech). Profane Ritual drops to 0.13 s the same way (frame 51:59).
- **Role:** damage multiplier. A delay-balanced skill fires at once and repeatedly.
- **Library mapping:** new: **Duration to the floor**.
- **PoB:** duration is modelled; the instant detonation and hits per large target are not established, so count them
  a hand calculation.
- **Patch check:** present.

### 14. Duration to the floor: Ember Fusillade, Scattering Calamity, Orb of Storms (52:14–54:17)

- **Chain:** Ember Fusillade's alternate quality is −2% skill effect duration per 1% (`act_int.lua:6088`); with
  enough reduction, embers hover 0.01 s and autofire (52:23–52:50). His Scattering Calamity (The Unborn Lich,
  `Data/Uniques/staff.lua:201`) does the same (52:57, no demo). Short-lived Orbs of Storms leave more Lightning
  Infusion Remnants (`act_int.lua:15582`), whose type Elemental Equilibrium rotates (`tree.lua:101120`; 53:16, speech).
- **Role:** damage rate.
- **Library mapping:** Duration to the floor; Quality as a stat line; Inputs and outputs.
- **PoB:** not established. **Patch check:** present.

## New shapes proposed

### Travel by action

- **Shape:** the build moves by an action it scales (a strike that closes distance, a longer dodge roll, a triggered
  teleport to an object or a cullable enemy), so buy that action's rate or distance, not movement speed.
- **Search:** the actions that relocate you (`mechanic "teleport" (gem)`, "Dash", "Dodge Roll distance"); their
  speed sources (attack or skill speed, weapon-set points); drawbacks made free (`mechanic "Cannot Dodge Roll or
  Sprint" (passive)`).
- **PoB:** not modelled. Travel is no output, so report it beside the numbers.
- **Examples:** Boneshatter at 6.76 attacks per second (31:53); Cast on Dodge with Gemling quality (03:41–07:05);
  Lightning Warp to Ball Lightning (33:00–35:28); Killing Palm's cull dashes (21:42).
- **Cautions:** no game text gives a strike's travel, so it needs in-game testing. Dodge-roll travel excludes
  Unwavering Stance.

### Charge-type converter

- **Shape:** the build makes one charge type cheaply, and a converter (a keystone or a random-type line) turns it into
  the type the payoff reads.
- **Search:** find the payoff's charge type; then `mechanic "instead of Endurance Charges" (passive)`, "random type"
  (gem); then the cheapest source-type generator (`mechanic "Endurance Charge" (gem)`).
- **PoB:** config stand-in for the counts; the rate is a hand calculation.
- **Examples:** Resonance with Armour Break III (37:56–40:54); Charge Profusion II on Profane Ritual (24:21, frame
  51:59).
- **Cautions:** Resonance rotates all three types, so the build's other generators change type too. A random type
  gives the one you want only some of the time (inference).

### Harmless self-trigger

- **Shape:** cancel the damage of an event that hurts you, then cause it on purpose, because a payoff scales with its
  size.
- **Search:** find payoffs on a self-event ("on you explodes", "per … exploded"); then the immunity (`mechanic "Take no
  Damage from" (passive)`) and a skill that sets the event off (`mechanic "detonate" (gem)`).
- **PoB:** custom modifier at the expected size; uptime is a hand calculation.
- **Examples:** Chayula volatility with Inner Turmoil and Catharsis (26:24–31:05).
- **Cautions:** the base payoff is the creator's word. A random size (20–200, 30:00) makes the window vary, so plan
  the refill.

### Duration to the floor

- **Shape:** a skill balanced around a delay (a fuse, a hover or a ritual) releases at once when its duration is
  pushed to the minimum, so a delayed effect becomes an immediate, repeatable one.
- **Search:** find delay text in the skill ("at the end of their duration", "After a short duration", "When the ritual
  is complete"); then sum the reductions (`mechanic "reduced Skill Effect Duration" (passive)`, Compressed Duration,
  Swift Affliction, Overabundance on limit skills, alternate quality).
- **PoB:** not established. Duration is modelled; whether damage follows depends on the skill.
- **Examples:** Spearfield with Delayed Reaction (49:30–50:48); Profane Ritual at 0.13 s (51:59); Ember Fusillade
  (52:23–52:50).
- **Cautions:** duration often pays damage too (damage over time, hazard lifetime). The creator gives 0.01 s as the
  floor (54:10).

### Off-tree defence layer

- **Shape:** a defence sourced only from gear and a spirit skill, refilled on kill, frees the tree's defence points
  for damage.
- **Search:** `mechanic "Runic Ward" (unique)`, then base and mod; refills via `mechanic "Remnant" (gem)`.
- **PoB:** not modelled until coverage shows otherwise. Base ward is modelled; flat ward mods are partly unparsed.
- **Examples:** a Titan's Brass Dome, Olroth's Resolve and Remnants of Kalguur (45:58–48:50).
- **Cautions:** it costs the 60-spirit chest prefix. Report effective HP and max hit as computed.

## Engine view

- **Wolf charge loop (the creator's):** a Minion Pact drain kills a wolf → Cast on Minion Death → a 0.13 s Profane
  Ritual → Charge Profusion II's random charge → frenzy for Charge Regulation → a faster Boneshatter drains again.
  This keeps charges up with no button pressed (22:12–26:22).
- **The same deaths feed volatility (the creator's, 28:43):** Unstable Bond turns each wolf death into volatility,
  which Catharsis detonates harmlessly for about 2× damage plus crit. One minion engine supplies both speed and the
  damage window.
- **Cull hub (inference across three segments):** with the threshold at 100% for white mobs, Killing Palm dashes,
  Lightning Warp teleports and Detonate Living explodes off one forced condition.
- **Two-set chassis (the creator's):** set 1 holds Boneshatter with attack-speed weapon-set points, set 2 the damage
  skill with the Rabid Dog re-summoned under you, and Lightning Warp moves stationary skills.
- **Lenses (the creator's, 36:37 and 39:12–39:37):** "what does this build travel with, and what scales it?" (often
  attack speed, which can make a drawback free); and, past the generator named for a resource, "which event does the
  build already cause that a converter could turn into it?", a sharper brainstorm question 5 (which routine action
  already produces the resource).

## Evidence and quality

The evidence is in-game footage and tooltips on legacy characters, some in the campaign. There is one before and
after tooltip (about 97k, then roughly doubled, 30:15), and the gem panels on screen match the chains. There are no
PoB numbers and no timed tests; "Boneshatter is always faster" is called objective but never raced. The creator is
candid about gaps (a broken setup at 23:31–25:17, the Detonate Living mystery) and careful about cost, but loose with
numbers and names.

## Links seen (unopened)

- https://www.youtube.com/watch?v=S1AzLxb3fZw
- https://poe.ninja/poe2/builds/streamers?streamername=<the channel>
- https://twitch.tv/787prada
- https://discord.gg/bdtxSWvtzt
- No URLs on screen in the frames taken; poedb is mentioned in speech (09:02) without a link.
