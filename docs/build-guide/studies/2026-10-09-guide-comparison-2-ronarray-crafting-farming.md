# Guide comparison 2: ronarray's crafting and farming videos

An agent's study report, kept verbatim (2026-10-09). Brief: given in the prompt.
Its claims are the agent's; the PoB gaps it cites were re-checked in `../pob-gaps.md`, and its patterns are consolidated in `../worklog.md`.

---

I read all seven transcripts and the amendment, and checked two crafting claims against the pinned PoB data. Short version: almost nothing here belongs in our guide. One idea is worth adopting (recommendation 1 below). A second one is optional.

## 1. Crafting (rQ0kydfdesI armour and amulet, RdKoRIffBBE weapon and rings)

**How he crafts.** Every slot follows the same steps:
1. **Buy cheap bases in bulk.** Item level 80, on a base whose own stats matter. Sinister Quarterstaff for "12% instead of usual 10%" crit (W 00:41), Ancestral Tiara (A 01:06), Sleek Jackets at about 3 exalts (A 12:19).
2. **Roll and sort.** Perfect Transmutation, then Augmentation. Bad bases get thrown away: "Throw bad ones aside" (A 02:04); a bad weapon prefix is thrown out "almost immediately" (W 01:57).
3. **Lock one key affix with an essence.** Enhancement for energy shield percent, resistance essences, Opulence for "practically tier one rarity" (W 14:02), Seeking for crit (W 08:47).
4. **Desecrate the side he needs and fill the rest.** He steers which side gets desecrated with sinistral/dextral omens, then fills with greater exalts (A 03:51–04:53).
5. **Reveal, and reroll only if the base was expensive.** The reroll omen "cost less than a divine": worth it on a 5-divine base, not on a 45-exalt one (W 09:38–09:55).

**His stop and branch rules.**
- The amulet quality trick (Essence of the Breach) is "worth it only if you have plus three" to melee skills (A 11:54).
- The Arcane Surge gloves need an energy-shield base, "otherwise you will be unable to roll arcane" (A 20:37–20:49). The odds of hitting it are "approximately 1 to 5" (A 24:00).
- Omen of Light is "most of the time … not really worth" it (A 25:11).

**Costs.**
- Amulet base: about 20 divines plain, 50 with +2 and 100 with +3. Rolling +3 yourself is about 1,700 chaos (A 07:44–08:18).
- Mid-tier staff bases cost 4–14 divines (W 07:02–07:15); a good result sells for 60–65 divines (W 12:34).
- Ring bases cost 2–3 divines (W 13:37).

**His refrain is to buy rather than craft:** "always check the market" (A 26:31), "might be easier to buy" (A 00:54). He calls Breach-ring crafting "wildly inefficient" and says to buy one (W 19:25). He titles the videos "& Other Builds" and says they apply to "any build" using ES/evasion (A description).

**What could belong in a build guide:** only the per-slot target plus where the affix comes from, when that changes what the reader buys. I checked his gloves claim in the pinned PoB data:
- The Arcane Surge on Crit affix is in the desecrated mod table, `ModVeiled.lua:163`: (10–15)% chance, level 65. Its weight is 0 on armour, evasion and armour/evasion gloves, so only gloves with energy shield can roll it. This matches 20:37.
- Our `lookup_game_data` mod hits already name their table ("Desecrated mods", `pob-api/API/Lookup.lua:502`).
- It does not show base-type weights, and it does not search `data.essences` (`Essence.lua`, e.g. Hysteria gives gloves 25–29% crit damage bonus, matching A 23:17). So "essence-only" and base limits would need a small lookup extension or a recorded claim.

## 2. Farming

- **spCSg_X3xbE** (filed as "Ritual", but it covers Ritual, Expedition and Abyss plus a general atlas tree): Ritual is the cheap starter, good "if your build cannot properly complete waystones with zero revives and maximum modifiers" (01:19). Abyss "requires a strong build" (description).
- **QsmXcmaDD1M, Breach:** clear breaches fast for Lavish wombgifts and turn them into catalysts; a tier-16 variant targets item-level-82 Breach rings. The method is "clear the breaches as fast as possible" (02:47).
- **Vd5Uhba-2sU, Abyss:** three tiers, from Ulaman chests to Amanamu rares to Delirium in the cities, where "your build should be pretty strong" (11:37). He suggests dropping the extra waystone modifier if the build is weak (05:21).
- **UfJflMmJ1BM, Boss Rush:** skip monsters and run straight to bosses for fragments. "No rarity requirement" (00:26). About 20+ divines an hour if fast (01:36), 10–15 for a slower build (09:24).
- **TXbVXloQDzQ, Expedition:** hunt logbook rumours (Fallen Stars leads to Aldur's Saga); profit is "directly connected to how fast" you go (07:40).

**Ties to the build:** none specific. He never links a strategy to monk or Whirling Assault. He only ranks content by generic traits: weak builds do Ritual (01:19), strong builds do juiced Abyss or Delirium (11:37), fast builds without rarity do Boss Rush (12:18). Every such line fails our swap test (the not-a-tutorial rule, G4: cut any sentence that would read true word for word in a guide for another build).

## 3. Recommendations

1. **Base and affix source in the slot table.** For each target, name the base when its base stats matter (the 12% crit staff) and the affix's source when it limits what the reader can buy: "Arcane Surge on Crit, a desecrated suffix, so the gloves must have energy shield."
   - **Touches** the budget and non-budget rungs' slot tables (G1 rows 9–10; G1 is the fixed 14-section reader outline with a 3,000-word cap). It passes G4: it names the build's key affix and changes what the reader buys.
   - **Needs** a D1 claim, or a lookup that reports base weights and the essence table.
   - **No tier labels:** G1 holds those back because our lookups can't supply them.
2. **Optional: one first-person line on content fit.** It would go in At a glance pros/cons (G1 row 1), drawn from the plan's own numbers (clear vs single-target DPS, the survival verdict). For example: "I'd farm content that rewards clear speed over boss kills." It's advice, so it is unverified by design. Name no atlas, tablet or strategy detail. Skip it if it reads as filler.
3. Nothing else clears the bar.

**Leave out:**
- **Crafting recipes (omen and currency sequences).**
  - G1 holds them back.
  - He flags them as patch-fragile: 0.5 removed the deterministic methods (A 00:39).
  - PoB can't verify them.
  - They are generic by his own framing ("& Other Builds").
- **Prices and craft-vs-buy thresholds.**
  - They depend on the market.
  - His only rule is "check the market".
  - We price only with your approval.
- **Affix tiers and roll quality:** held back by G1.
- **Niche high-end tricks:** the Essence of the Breach quality step and fracture-and-chaos Breach rings.
- **All atlas content:** trees, tablets, masters, waystone mods and rumours.
  - G1 holds back an atlas section.
  - It isn't tied to the build.
  - It goes stale fast: a master node bugged (Breach 07:05), Genesis nodes bugged (Breach 03:53), "abyss getting nerfed" (Breach 00:00).
- **Profit-per-hour figures** (23 divines an hour, Boss Rush 09:17): unverifiable and economy-dependent.
- **Rarity on gear as a farming stat** (A 02:04, W 13:55): generic, so it fails the swap test.
- **The entering-maps rung (G5, the stage just after the campaign within 5 divines):** these crafts give it nothing to cite. His cheap crafts cost little, but they are reroll gambles, not something we can quote as a target.
