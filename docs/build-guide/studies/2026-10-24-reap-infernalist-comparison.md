# GL1TCH3D's Reaper of Souls against our two Bonfire Reap Infernalists (2026-10-24)

**Ours** are the two builds the open-brief half of the live test (WU-109) finalized, in `open-clear/2026-10-24-1`
(online, outside this repo). The brief was "bleeding as the main source of damage, fast map clear, any ascendancy".
The run ran in real conditions: the everyday server, rebuilt from `main` at `5f023e5`, with web access and the user's
own folders.
- **Reaping Bonfire Reap Infernalist** (`r2-s-2`): three design attempts.
- **Culling Bonfire Reap Infernalist** (`r2-g-1`): two design attempts.

F1 filed both, and no guides were written.

**His** is GL1TCH3D's Reap Infernalist. The user named three sources:
- **[video]** "Reaper of Souls Demon Form Infernalist - Path of Exile 2" (YouTube `-c0jG0hmyF4`, 2026-04-22, 10:50);
- **[page]** its Mobalytics page (`reap-infernalist-gl1tch3d`), tagged 0.5. It defaults to a league-start / budget
  variant and keeps the video's version as the "0.4 Tempo Version" tab;
- **[pob]** the user's PoB files "Reaper of Souls Infernalist - 0.4" and "- 0.5", the second with the tree converted to
  0.5 by the user.

Times are `mm:ss` in [video]. Numbers come from the pinned engine (0.5.4), with each file copied into a temp
server and measured on its active loadout. For ours, that loadout is the level-95 non-budget rung.

## 1. Summary

- **The user's verdict:** "Overall, the build was close, just a few tree and gear misses hobbled it. It got probably
  90% of the way there on its own, which isn't bad. So yes, in the right range, just a few small misses that would have
  made a large improvement."
- **Like for like against a Pinnacle boss, his build wins at a lower level and on cheaper gear** (§3). Neither
  side's file is near the user's toughness bar (a 14k-EHP Gemling of their own).
- **The misses are small and cheap to fix** (§4):
  - Throatseeker, which both ranking tools put first, is missing from both trees;
  - the body armour gives up all defence for aggravated bleeding, when a 1-point keystone recovers most of that
    damage on a defensive rare;
  - the boots have 30% movement speed, not the top tier's 35%.
- **The engines differ.** His is self-cast crit Reap: 88% hits, no aggravation and no bleed engine. Ours is Detonate
  Dead fired by Cast on Critical from Reap's crits, and 79% of its damage is bleed and ignite. The brief asked for
  bleed, so the comparison is the same skill and ascendancy, not the same build.
- **Culling's headline 2.72M is a white-mob number** (§4.4).

## 2. The builds

| | Ours (both) | His (0.5 file) |
|---|---|---|
| Level | 95 | 83 |
| Damage | Detonate Dead via Cast on Critical (Bleed III, Deep Cuts II, Boundless Energy II, Supercritical, Corpse Conservation); Reap feeds the crits | Reap, self-cast at 100% crit (Considered Casting, Pinpoint Critical, Execute III, Deliberation); Demon Form |
| Ascendancy | Altered Flesh, Bringer of Flame | Demonic Possession (Demon Form), Beidat's Will (25% of life reserved), Altered Flesh |
| Keystones | none (Culling: Iron Reflexes) | Eldritch Battery, Mind Over Matter, Pain Attunement |
| Tree | crit, ailments, trigger and Energy nodes | spell damage, crit, mana; five jewel sockets |
| Weapon | Reaping Staff rare: +7 physical spell levels, 50% ailment magnitude | Reaping Staff rare: +5 spell levels, 52% cast speed, extra cold and fire |
| Body | Apron of Emiran: aggravates your bleeding; no life, no resistances | Vile Robe rare: ES, which Eldritch Battery turns into mana |
| Boots | rare, 30% movement speed | Trampletoe (overkill hits other enemies, "very much required" for clear, 09:09–09:48) |
| Defence | 2.2–2.6k life, a little ES and armour, capped resistances | Low life through Coward's Legacy and Beidat's Will; a 3,260 mana buffer through Mind Over Matter |

Culling differs from Reaping in its cull pieces: Myris Uxor, Deathblow, Bounty Hunter, Heart of the Well and three
cull smalls.

## 3. Numbers

Each file's own config, then all three against a Pinnacle boss:

| | Full DPS, own config | Full DPS, Pinnacle boss | EHP, Pinnacle boss |
|---|---|---|---|
| His, level 83 | 352,230 (set to a boss already) | **352,230** | 7,721 |
| Reaping, level 95 | 336,763 (not a boss) | **267,552** | 5,863 |
| Culling, level 95 | 2,717,385 (not a boss) | **222,149** | 6,601 |

- Against a boss, our ignite halves (Reaping 109k → 56k).
- PoB assumes Detonate Dead always has a corpse. Its corpse life comes from PoB's table of monster life by area level
  (32,956 here).
- On screen, [video] shows 4.5M–8.3M for the 0.4 version with The Vertex (02:59, 08:56, 09:50), with no conditions
  stated. The 0.5 file is the cheaper variant.
- **The 0.4 → 0.5 conversion is clean.** Both files allocate the same 114 nodes, and the engine scores them 355,055
  and 352,230 (−0.8%).

## 4. The misses

### 4.1 Throatseeker: the tree search

Throatseeker (60% increased crit damage bonus, 20% reduced crit chance) is 5 points away in both builds. With its path
it adds **+17.2%** (Reaping) and **+17.3%** (Culling). Both `get_passive_upgrades` and `get_node_power` rank it first,
and both count bleed and ignite, so the ranking figure isn't the cause.

The cause is the design's swap search. D1-tree runs node power with lists of nodes it may not touch: the build's
declared needs and the previous rung's tree (`keep`), plus later rungs' needs (`protect_for`). The search frees one of
the five weakest branches at a time. A 5-point path never fit. Without those limits, the same tool finds a 7-point
swap worth +16.9% and a full rebuild worth **+22.8% Full DPS and +25% EHP** (Reaping).

### 4.2 The body armour: the defence trade nobody offered

PoB models aggravation as 100% more bleed magnitude (`CalcSetup.lua`), so the designers paid for Apron of Emiran
with a body that has no life and no resistances. The alternatives, on a level-82 Sacramental Robe rare (+160 life,
ES, three resistances):

| Variant | Reaping Full DPS | EHP |
|---|---|---|
| Apron of Emiran, as built | 336,763 | 5,997 |
| Rare, no aggravation | −23.4% | +16.7% |
| Rare + Crimson Assault (keystone, 1 point: all bleeding aggravated) | −8.8% | +16.7% |
| Rare + Beetlebite boots (aggravates enemies that enter your Presence) | ±0 with the config ticked | +15% |

Crimson Assault's 50% more magnitude loses some damage to its 1-second base bleed duration. PoB doesn't parse
Beetlebite's line, so its row rests on the config tick, and the boots would replace the movement-speed boots. The
user: "Sacrificing body armour defenses for aggravated bleeding is questionable." The design gate should have shown
this trade.

### 4.3 Boots

Both builds' boots have 30% movement speed. The user's rule: top-tier 35% boots on every endgame character, except
a build that moves with a travel skill.

### 4.4 The culling figure

The design measures against normal map monsters. There, Culling Strike's base threshold is 35%, and the build's +160%
increased threshold makes it 91%: an ×11.1 multiplier. Against a boss the build does 222k. A design gate that shows a
map-monster figure needs the boss figure beside it.

## 5. Mechanics PoB can't measure

The level-95 tree dropped five measured crit-damage smalls (held at level 90) for trigger and Energy nodes:
Dynamism, Evocational Practitioner, two Energy and Critical Chance nodes, and two Triggered Spell Damage nodes. PoB
doesn't apply their "Meta Skills gain X% Energy" lines.

The first fix proposed was "don't let unmeasurable nodes displace measured ones". The user's concern: that would
weaken a build that relies on a mechanic PoB doesn't support. **The concern holds here.** The pinned PoB has no model of
meta-skill Energy at all: no calc module reads it. It scores the triggered Detonate Dead at 1.46 uses a second without
checking whether Cast on Critical can gather Energy that fast. The Energy nodes are what move the game's trigger
rate toward the one PoB assumes, so stripping them would make the build worse in game while PoB showed a gain.

The rule instead:
- An unmodelled node may take a measured node's place when it serves a mechanic the build rests on.
- The design gate shows the trade: what it costs in measured damage, and what PoB can't measure.
- A trigger build's damage figure states the trigger rate PoB assumes, as a caveat.

## 6. What the run got right

- A working bleed-and-ignite engine on a skill the brief didn't name, with ailment magnitude, crit and corpse life
  scaling it. PoB measures it at 268k against a boss.
- Capped resistances, and life on the rare armour pieces.
- Reap from a Reaping Staff rare, the same weapon base as his.

## 7. Fixes queued

They join the WU-109 feedback queue for the post-run amendment, with the user's notes from the run:
- the tree search frees several weak branches at once, or runs a rebuild pass from the build's needs;
- unmodelled nodes follow §5's rule;
- a boss figure beside every map-monster figure;
- the design gate offers defence trades such as the body armour explicitly;
- 35% movement-speed boots, unless a travel skill moves the build.

## 8. Cost

- **The run:** 40 agents; 3.84M output tokens (2.26M of them thinking), 564M cache read, 12.0M cache write. By stage:
  design 1.59M for five attempts, R1a 1.14M, R1b 683K, the runner 252K, the rival 85K, a gate question 80K.
- **This comparison:** the reference digest 143K and the engine comparison 292K.
