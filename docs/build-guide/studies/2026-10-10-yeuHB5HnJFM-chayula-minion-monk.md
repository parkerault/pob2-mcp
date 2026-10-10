# Chayula Monk minions (GhazzyTV)

An agent's study report, kept verbatim (2026-10-10). Brief: `briefs/offmeta-brief-2.md`.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

## 1. Header
- **Video:** yeuHB5HnJFM, "IT OUTPERFORMS THE MONKEY! - Chayula Monk Minion Build Guide [PoE2 0.5]".
- **Creator:** GhazzyTV. Uploaded 2026-06-05.
- **Patch:** 0.5.
- **Build:** Acolyte of Chayula, with Skeletal Reaver minions as the main damage. Gargantuan Wasp / Plague Harvester spectres are named as the alternative for the Sekhema trials.
- **Budget:** the creator calls it the "lower budget version" in "pretty bad gear". The jewels cost about 1 exalted each and the 40-exalted chest is the most expensive item. A high-budget version is still to come.

## 2. The chain
1. **Source.** The Waking Dream ascendancy node grants the skill Into the Breach (05:27). It creates Flames of Chayula, which are remnants you pick up. Choice of Power makes every flame purple, which means damage gained as extra chaos (05:32; confirmed on a frame). In PoB data each purple flame gives 7% damage as extra chaos, scaled by remnant effect, up to 10 stacks.
2. **The redirect, the clever link.** Into the Breach is supported by **Selfless Remnants**: "Remnants from Supported Skills affect Allies in your Presence instead of you when collected" (06:08–06:14; confirmed on a frame, where the transcript misheard it as "cell plus remnants"). The Monk's self-buff becomes a buff on the minions.
3. **Magnitude.** The creator says 10 stacks give 182% damage as extra chaos to minions at character level 90 (06:44–06:56). That figure is speech only and never appears on screen. It implies about +160% remnant effect: 7% × 2.6 × 10 = 182%.
4. **Sustain.** Pickup range and extra-remnant nodes keep the stacks up while standing nearly still: Remnant Attraction, Remnant Pickup Range and Empowering Remnants (06:38–06:48). Remnant Attraction and Remnant Pickup Range are confirmed on a frame; Empowering Remnants rests on speech plus PoB tree data.
5. **Range.** The minions must stay inside your Presence (the area around you where aura-type effects apply). The creator scales its radius with:
   - Profane Commander: 30% increased Presence area (frame 07:08);
   - a planned Warlord Leader anoint, misheard as "World Leader" (frame 07:04);
   - optionally Alpha's Howl, "Presence Radius is doubled", in a twice-corrupted copy with +1 to minion skills (07:14–07:16; frame).
6. **Keeping the minions alive keeps the damage.** The stacks are lost when a minion dies, so they must be re-collected (08:37). The creator caps minion resistances with two cheap jewels, takes Living Death, and may add From Nothing for Gigantic Following later (07:40–08:55). Speech only.
7. **Weapon and minions.** A +3 minion-level weapon and a +2 amulet (09:21, 11:05). The frame at 06:10 shows Skeletal Reaver at level 25 with 8 summoned, plus Skeletal Storm Mage and Skeletal Cleric for utility. Minion Splash is named as a support (speech; the gem exists in PoB).

**Leveling trick:** wear Radiant Grief ("Enemies in your Presence are Ignited") and trigger the Skeletal Archers' Gas Arrow command next to enemies. The ignite makes the gas clouds explode (03:20–03:33). Speech plus PoB unique data.

## 3. Patterns
- **New pattern, "buff relay":** a support or item turns a player-only buff into a buff on allies or minions. Here it is Selfless Remnants; The Hollow Mask (0.5 variant) does the same "as well as you". It works with any remnant skill, such as Infusion, Mana, Life or Grim Remnants, or any self-buff with an "affect Allies in your Presence" redirect.
  - **Search step:** start from an ascendancy's or skill's self-buff. Search gem, unique and tree text for "Allies in your Presence" together with "instead of you" or "as well as you". Then check whether the buff's stat is skill-agnostic (gain-as-extra).
- **Part of the relay: Presence radius as uptime.** Scaling Presence area doesn't add damage; it keeps minions inside the relayed buff.
- **defence that scales damage:** minion resistances and survivability protect stacks that live on the minions.
- **inputs-and-outputs** (a skill's by-products feed another mechanic): the archers' gas clouds are detonated by the player's ignite aura while leveling.
- **inert minions** (minions as triggers or headcount): the Cleric and Storm Mage do utility or defence work.
- **Minor new pattern, "outcome lock":** a node fixes a random effect to its best variant ("All Flames of Chayula that you manifest are Purple").
  - **Search step:** search ascendancy text for "All … are" or "instead of".

## 4. How PoB follows it
- **The relay can't be followed natively.** PoB adds the purple-flame gain to the player's own stats only (`Modules/CalcPerform.lua:1379-1397`). The Selfless Remnants stat `remnants_affect_allies_in_presence_instead` (`Data/Skills/sup_str.lua:6617`) is never used by any calculation. The Hollow Mask line is unparsed (`Data/ModCache.lua:6609`).
- **Workaround:** hand-calculate the gain, then add the custom mod "Allies in your Presence Gain N% of Damage as Extra Chaos Damage". That line parses as an allies-only aura (`ModCache.lua:3817`). PoB floors the per-flame value (`CalcPerform.lua:1385`), so expect 180 where the creator says 182.
- **Count-approximated:** set Count = 8 on the Skeletal Reaver group, the number of Reavers on the 06:10 frame.
- **Not modelled:** Empowering Remnants is only partly parsed (`ModCache.lua:1574`). It affects sustain only.
- **Modelled but assumed:** Alpha's Howl's doubled radius parses (`ModCache.lua:6450`), but whether the minions stay inside Presence is a config assumption.
- **Missing from PoB data:** nothing the chain depends on. I didn't check the "Volgaard" leveling spectre.

## 5. Evidence and quality
- **Evidence:** spoken claims only. The creator says he clears tier 13 maps with the full Atlas passive tree at level 78. The frames I sampled show the hideout, the tree and gear, with no PoB DPS figures, boss kills or tests. The 182% is never shown on screen.
- **Quality:** medium. The mechanism is explained clearly and the key nodes are shown, but there are few numbers. It is a progress update to a written guide, and the creator calls its tree a "placeholder".

## 6. For the brainstorm phase
- Read the ascendancy's self-buffs and ask whether a support can redirect them to minions. Off-class minions become viable when the buff is a skill-agnostic gain-as-extra.
- Sanity check: if buff stacks live on minions, minion survivability is damage uptime. Cap minion resistances first.
- Once a relay is chosen, add Presence radius as a required sub-link.

## 7. Links seen (unopened)
- https://www.poe-vault.com/poe2/monk/acolyte-of-chayula/chaos-minion-leveling-build
- https://www.poe-vault.com/poe2/monk/acolyte-of-chayula/breach-minions-build-guide
- ghazzytv.com (merch).
- No PoB, pobb.in or poe.ninja links.

## 8. Reference entry
- yeuHB5HnJFM (GhazzyTV, 0.5): Acolyte of Chayula Skeletal Reavers.
- Chain: Into the Breach purple flames, redirected to minions by Selfless Remnants, give about 182% damage as extra chaos at 10 stacks. Presence radius (Profane Commander, Warlord Leader, Alpha's Howl) keeps all minions in range; capped minion resistances keep the stacks alive.
- Patterns: buff relay (new), outcome lock (new), defence that scales damage, inputs-and-outputs (leveling), inert minions.
- PoB: the relay is unmodelled (`CalcPerform.lua:1397`); use the custom mod "Allies in your Presence Gain N% of Damage as Extra Chaos Damage" with Count = 8. Guides are on poe-vault (links above); no PoB link.

I used 8 of the 10 frames. The names confirmed on a frame are Selfless Remnants, Choice of Power, Chayula's Gift (not allocated), Warlord Leader, Profane Commander, Alpha's Howl, Remnant Attraction, and Skeletal Reaver at level 25 with 8 summoned.
