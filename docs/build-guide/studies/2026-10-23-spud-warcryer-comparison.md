# Spud the King's Warcryer against our Wand-and-Shield Warcaller (2026-10-23)

**Ours** is build r1-b-3 of the open-clear run (`open-clear/2026-10-19-1`, online, outside this repo), finalized on
2026-10-23 as "Wand-and-Shield Warcaller": its endgame guide, plan, compile records and the session's stage returns.
The user asked that run to focus on warcries as a source of damage so it could be compared with this build.

**His** is Spud the King's warcry Warbringer, which came out of a random-build challenge that rolled a warcry as the
main skill. The user named three sources:
- **[warcryer]** "I CRY - THEY BLOW UP... Nuclear WARCRYER Build POE 2" (YouTube `PY5ZqIiLW0k`, 2026-09-08, 29:55);
- **[planner]** its Mobalytics planner from the pinned comment, "DOUBLE DOT - TRIPLE DMG Shield Wall STARTER" (Creator
  tab, 0.5.5, updated 2026-09-15, 117 favourites), saved through Playwright on 2026-10-23 outside the repo, with its
  build download: the game's own build-planner files, one per variant (Act 1–6, level 90 endgame, final form, a rich
  version), holding full item text and gem lists;
- **[aof]** his "SECRET PASSIVE That 99.7% Players IGNORE (It's actually OP)" (YouTube `VrEOjufM6Q0`, 2026-10-06,
  25:45), on Avatar of Fire.

Times are `mm:ss` in the named video. Claims are the creator's unless marked **pin**, checked against the pinned
PoB data (0.5.4; `vendor/PathOfBuilding-PoE2/src/`). **No figure is compared side by side:** the planner has no PoB
code, and its passive tree uses the game's internal node ids (`warcries52`, `AscendancyWarrior2Notable1`), which
neither PoB's tree data nor ours can map. His evidence is in-game; ours is PoB's.

## 1. Summary

- **The run found his core.** Warbringer's Warcaller's Bellow spamming Seismic Cry, Avatar of Fire, a cheap rare
  wand in the weapon slot the cry doesn't read, a shield with Renly's Training and Chernobog's Pillar, and Anvil's
  Weight into Imploding Impacts. That combination is what makes a warcry a main skill, and he says it took him a
  challenge run and later play to find ([warcryer] 00:54–01:13).
- **He kept building where ours stopped.** His warcries carry six damage layers to our two, he removed the limit
  our guide lists as its main con (mana), he counts three warcries where we count one, and he has a boss setup
  (§4).
- **Most of his pieces were in our deck, on different cards** (§6.1). The deck deals independent cards, the user
  picks some, and the design step builds one card; nothing combines them. The user's reading (2026-10-23): "having
  multiple independent cards is not how a human build designer would work. They'd be doing the same brainstorm
  process, but synthesizing it into one build, not dropping all but one idea."
- **Avatar of Fire:** [aof] says gained cold and lightning are lost under the keystone, the opposite of the ruling
  our build's damage rests on (§5). Neither side shows a test; PoB agrees with [aof].

## 2. The two builds

| | Ours (r1-b-3) | His (level 90 and final variants) |
|---|---|---|
| Ascendancy | Warcaller's Bellow, Anvil's Weight, Imploding Impacts, Renly's Training | Bellow (11:31), Anvil's Weight (03:11), Renly's Training (11:04), Imploding Impacts (15:15); Jade Heritage offered in its place (22:43), and both variants socket Encase in Jade |
| Damage | Seismic Cry; Bellow's corpse explosion | Seismic Cry; ignite; bleeding as fire; two corpse explosions; Battershout detonations (§4.1) |
| Conversion | Avatar of Fire; the wand's gained cold and lightning counted as fire by custom modifiers (the user's ruling) | Avatar of Fire; the level-90 wand gains 16% extra cold, the final wand extra fire only |
| Weapon | Rare wand: gain 26–29% as extra fire, cold and lightning; mana per kill | Rare wand: gain 22–25% as extra fire, 69–105% increased fire; the final adds bleed magnitude, exposure effect, flammability magnitude, 54 life per kill ([planner]) |
| Off hand | Chernobog's Pillar from the budget rung | Chernobog's Pillar |
| Helmet, amulet, rings | Rares; Prism of Belief (+2 Seismic Cry) | Deidbell; Xoph's Blood; Blistering Bond and a rare |
| Seismic Cry's supports | Elemental Focus, Physical Mastery, Fire Penetration II, Magnified Area II, Efficiency II | Bleed III, Fire Attunement, Exposing Cry, Uruk's Smelting (Potent Exposure in the final) |
| Other warcries | None | Infernal Cry (Battershout, Raging Cry, Bleed III), Fortifying Cry |
| Bosses | The same cry | Shield Wall detonated by warcries, Hammer of the Gods on a rune-forged Hoghunt in the second weapon set, Elemental Weakness on Cursed Ground |
| Costs | Mana: mana per kill, regeneration, Urgent Call's refund, the flask | Life (Blood Magic): life per kill on wand and gloves (69), Taste for Blood, a Utility Belt |
| Defence | Armour, block, capped resistances; the budget rung survives the Arbiter at 0.96 of its max hit | Armour with "Armour also applies to Elemental Damage" on most pieces, Magma Barrier, Scavenged Plating, Berserk, Encase in Jade |
| Evidence | PoB: about 7k, 21k and 33k DPS on its three rungs | In game: tier-15 bosses (00:18), 200% Delirium and the pinnacle bosses (01:27), the Arbiter on day 1 at level 90 ([planner]) |
| Cost | 0.1–0.3, 7.3–17 and 33–53 divines | "around five divines" (00:30) |

## 3. What both found

- **Warcaller's Bellow** (pin: "Ignore Warcry Cooldowns", corpses explode for 25% of their life) turns a cooldown
  skill into the button you hold.
- **The weapon slot as a stat stick:** a warcry reads no weapon, so a cheap rare wand carries gain-as-extra damage
  that nobody else bids for ([warcryer] 04:19–04:37; our card's own pitch).
- **The shield as damage:** Renly's Training sets 35% base block from the shield, Chernobog's Pillar gains fire per
  1% block, and Lay Siege (pin: "1% increased Damage per 1% Chance to Block") adds damage from the same block.
- **Armour break as a multiplier:** Anvil's Weight breaks armour with any hit, and Imploding Impacts makes fully
  broken armour raise all hit damage taken.

Our deck rated this card "under-played". On the starting insight the pipeline matched a skilled designer, in one
brainstorm.

## 4. Where his goes further

### 4.1 More damage layers

| Layer | His | Ours |
|---|---|---|
| The cry's hit | Seismic Cry | Seismic Cry |
| Ignite | Fire Attunement, and flammability magnitude on the wand | None: Elemental Focus forbids elemental ailments; the design dropped ignite at 0.8% of DPS |
| Bleeding as fire | Blistering Bond (pin: "Fire Damage also Contributes to Bleeding Magnitude", "Bleeding you inflict deals Fire Damage") with Bleed III on each skill (01:45–02:58) | None |
| Corpse explosions | Bellow and Deidbell (pin: "Warcries Explode Corpses dealing 10% of their Life", plus 20–30% warcry speed) (06:29–06:48) | Bellow only; the design judged Deidbell on its area line alone ("about 5% more radius") |
| Armour detonation | Battershout on Infernal Cry (pin: consumes fully broken armour for a physical explosion sized by the target's broken armour) (05:25–06:29) | None |
| Resistance | Xoph's Blood (pin: enemies in your presence −25% fire resistance), Exposing Cry, Potent Exposure, exposure on the wand and a rune, Elemental Weakness | Fire Penetration II |

**Pin:** ignite deals 20% of the hit's fire damage per second for 4 seconds (`Data/Misc.lua`:
`IgniteHitDamagePercentPerMinute` 1200, `BaseIgniteDuration` 4), as [aof] says at 16:00.

Battershout is the "Scale the scaler" lens reaching into enemy stats: damage ← broken armour ← how much armour
breaks (Anvil's Weight, Uruk's Smelting, Imploding Impacts breaking below zero) ← the enemy's armour, which map
modifiers raise, so it hits harder in harder maps (05:51–06:10).

### 4.2 The limit removed

Our guide's main con is "mana, not a cooldown, sets the pace": PoB assumes 4.4 cries a second, and on a boss mana
pays for about 0.72. He moved costs to life with Blood Magic (pin: "You have no Mana / Skill Mana Costs Converted to
Life Costs") and pays with life per kill and Taste for Blood (pin: "Gain 20 Life per enemy killed / 2% chance to
Recover all Life when you Kill an Enemy") (19:38–20:37). It also turns on Zerphi's Infamy, which our design rejected
because Zerphi's "needs 50 Glory a use from life spent on other skills, and this build spends mana". Its cost shows
in his own advice: on a dangerous map, drop Blood Magic for mana (26:20).

### 4.3 A count left at one

Escalation (pin: "20% increased Damage for each different Warcry you've used Recently") is on both trees. Ours counts
one warcry, the "about 6% more damage" in its ledger. His counts three, Seismic, Infernal and Fortifying Cry
(09:10–09:24). Brainstorm question 12 ("What grows with a count, and what pays for a bigger count?") finds this
when it is asked of the design and not only of the cards.

### 4.4 A boss setup

Shield Wall, detonated by warcries with Fortifying Cry for a second detonation; Hammer of the Gods on a rune-forged
Hoghunt for crit with Prototype Seventeen and Rage; Elemental Weakness on Cursed Ground for fire-resistant bosses
(07:11–08:14, 12:02–13:25, 15:56–19:31). Ours uses the same cry on bosses, where mana caps its rate.

## 5. Avatar of Fire ([aof])

- **The damage stages** (02:00–06:40, a whiteboard diagram at 05:55–06:27, not a measurement):
  - Gain-as-extra lines and conversions act together, in the conversion stage.
  - Avatar's 75% converts only damage that isn't fire already (14:27–14:51).
  - **Gained non-fire damage is lost:** "if you got this gain extra as lightning it will never work", because of
    "Deal no Non-Fire Damage" (06:00–06:20).
  - Other conversions on gear compete with Avatar's (06:26).
- **Where the keystone pays** (13:20–21:54):
  - Its payoff is a large ignite plus fire-only scaling: increased fire nodes, fire curses, Rakiata's Flow,
    penetration.
  - Only the biggest ignite applies, so it favours big, infrequent hits. In his example it breaks even at one hit
    every 1.67 seconds, and he gives "two hits per second as a baseline".
- **Gained extra fire scales with increased fire** (22:26).
- **Untested:** whether Xoph's Blood and fire penetration stack (23:37–23:48).
- **Blistering Bond doubles the damage over time,** but only on a skill that can already inflict bleeding
  (24:04–24:48).

**Against our build.** At the verification gate (2026-10-19) the user ruled: "Avatar of Fire conversion happens after
'gain as extra' is applied. PoB is wrong in this case." r1-b-3 carries that as custom modifiers, 39–45% gained
fire per rung, and its guide marks it unconfirmed. [aof] says the opposite, and PoB agrees with it. His own wands
are split: the level-90 variant gains 16% extra cold; the final gains extra fire only. Neither side shows a test. If
[aof] is right, r1-b-3 loses the modifiers, about a quarter of its damage by its guide's own estimate, and its wand
should roll gained fire and increased fire, as his does.

## 6. Why our pipeline missed it

### 6.1 The deck split his pieces across cards

| His piece | Where it was in our run |
|---|---|
| Deidbell's second corpse explosion | Card r1-b-1 "Triple Corpse Bellow" (Bellow, Deidbell and a Legacy of Deidbell rune: 45% of corpse life), not dealt as "the same build as Seismic Bellow Spam" |
| Hammer of the Gods for bosses | Card r1-a-3 "Seismic Hammerfall Warbringer", dealt, not picked |
| Raging Cry and Rage | The Titan cards (r1-b-2, r1-c-2) and the Shaman (r1-a-2) |
| Battershout | The research files, and r1-b-3's own card, which named it a payoff thief (it would consume the broken armour Imploding Impacts needs) and left it out |
| Infernal Cry, Fortifying Cry, Exposing Cry | The research files |
| Blistering Bond, Xoph's Blood, Blood Magic, bleeding, Shield Wall, Uruk's Smelting, Elemental Weakness, Taste for Blood | Never searched |

The deck's rules make each card one engine, merge duplicates and leave the choice to the user; the design step then
builds one card. The pieces of a composite build were found and then set aside, card by card.

### 6.2 Pieces judged alone

The design step looked up Deidbell and judged it as an area item. It dropped ignite at 0.8% of DPS once Elemental
Focus had turned ailments off, and Zerphi's Infamy because the build spends mana. It also left Fire Attunement out:
"Physical Mastery's +1 level does as much without the open question". Each rejection is right for the structure it
was measured against and wrong for the structure he built: the local maximum the user has warned about.

The card ruled Battershout out under the library's "Payoff thief (anti-pattern)": it consumes the broken armour
Imploding Impacts needs. He has the same conflict and schedules it instead: Battershout goes on Infernal Cry for
clear, where packs die whether their armour stays broken or not, and Fortifying Cry, his boss warcry, carries none,
so broken armour stays for Imploding Impacts (14:51–15:34).

### 6.3 Lenses not asked again after the design changed

Avatar of Fire entered at the gate (the user's change). The design step read the pattern library whole and grepped
the rules index for warcry, armour-break and conversion lines. Its lookups searched mana sustain four times and
searched no fire payoff and no life cost. Two of the library's entries would have found his pieces:
- **"Type conversion so another mechanic applies"** (after a "Converted" line, search the new type's phrase): a
  search for "Fire Damage also" (unique) finds Blistering Bond.
- **"Cost redirection"** would have found Blood Magic, but its Search starts from "scaling keyed to a full pool",
  not from a resource that caps the build's rate, so it didn't fire here.

### 6.4 The tree step had no part

D1-tree, the step that fixes the passive tree, made one swap, on the budget rung: two life-regeneration nodes for
fire and elemental damage, +7% DPS. Avatar of Fire was kept as a need, a node its swaps must keep, and the D1 gate
found no better swap. One side effect: the custom modifier makes node power, PoB's per-node damage measure, rate
dropping Avatar of Fire as a gain, since the modifier doesn't know it depends on the keystone. The guide warns
about this.

## 7. Lessons for the amendment

1. **Synthesis, not selection** (the user's direction). The brainstorm's ideas feed one build: cards are
   candidate pieces and structures, the duplicates' distinct pieces are kept, and the design draws from all of
   them.
2. **Ask the lenses again at design,** after a conversion or keystone enters, and whenever the build names a
   limit as a con. Broaden "Cost redirection"'s trigger to a resource that caps the rate.
3. **A breadth question beside the depth one:** what other damage can this button cause? Ailments, explosions,
   detonations, other warcries.
4. **Judge a piece with the pieces it needs,** not alone against the current structure: Deidbell with corpse
   explosions, ignite without Elemental Focus, Zerphi's with life costs. A payoff thief is a conflict to schedule
   (one button for clear, another for bosses) before it is a reason to leave a piece out.
5. **A second button for bosses** as a standard check when the clear skill is rate-limited or area-shaped.
6. **Avatar of Fire's order** needs an in-game test (a wand's gained lightning under the keystone, on and off).
   Until then, record it as contested: the user's ruling against [aof] and PoB.

## 8. Caveats

- His build has weeks of play and a creator's tuning; ours is one run, PoB only, untested in game.
- His claims are spoken or drawn. Those marked pin were checked against game text; Taste for Blood and the rest of
  the tree weren't, since the planner's node ids can't be mapped.
- The planner (0.5.5, updated 2026-09-15) and [aof] (2026-10-06) postdate the pin (0.5.4). Two of the planner's
  variants weren't studied: the Act 1–6 variant (Shield Wall for the campaign) and the rich version.
