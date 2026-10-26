/**
 * What the currency exchange sells (D-444, amendment 11 §12; amends D-387).
 *
 * Players buy whatever the in-game currency exchange sells there, not on the trade site, so `get_item_price` prices
 * every exchange item from poe.ninja's currency exchange, by its category, and sends the trade site only what the
 * exchange doesn't sell: uniques (gear and tablets), rares, gear bases. The categories are poe.ninja's PoE2
 * exchange `type`s (`GET /poe2/api/economy/exchange/current/overview?league=<league>&type=<type>`), and the kinds
 * below are what each one lists, from WU-112's spike (2026-10-25, league Forbidden Rites; the saved responses are
 * the fixtures under `tests/fixtures/poeninja/exchange/`). Socketables, emotions, essences and lineage support gems
 * are checked against the pinned PoB data as well (`vendor/…/Data/ModRunes.lua`, `LiquidEmotions.lua`,
 * `Essence.lua`, `Gems.lua`), and no unique or other gem PoB knows matches a kind (`tests/unit/exchangeKinds.test.ts`).
 *
 * What each category lists (the spike):
 * - `Currency`: orbs and shards, infusers, the Mirror, Glassblower's Bauble, Gemcutter's Prism and the like;
 * - `Fragments`: reliquary keys, crisis fragments, fates, origin fragments, Simulacrum and its splinters;
 * - `Abyss`: abyssal bones, and the abyssal eyes (`… 's Gaze`);
 * - `UncutGems`: uncut skill, spirit and support gems, by level;
 * - `LineageSupportGems`: the lineage support gems;
 * - `Essences`: essences, every tier;
 * - `SoulCores`: soul cores, theses and the Raven-Touched Shard;
 * - `Idols`: idols and carved idols;
 * - `Runes`: runes, every tier, the named runes (`… 's Rune of …`) and the Aldur runes;
 * - `Ritual`: omens, and the King's tribute items;
 * - `Expedition`: fluxes, logbooks and sagas;
 * - `Delirium`: the Distilled Emotions;
 * - `Breach`: catalysts, Breach splinters and Breachstones;
 * - `Verisium`: Verisium, alloys, starlit ores and crests.
 * Not on poe.ninja's exchange: uniques (poe.ninja prices them from trade listings, its `stash` endpoints, with
 * precursor tablets) and rares.
 *
 * An item is recognised by its name alone: its category is fixed before poe.ninja is asked. One its category doesn't
 * list is searched on the trade site by name (the user's ruling, 2026-10-25), and is unavailable, naming both routes,
 * when that finds none too (`get_item_price`, `src/handlers/tradeHandlers.ts`).
 */

/** poe.ninja's PoE2 currency-exchange categories (the overview's `type`). */
export const EXCHANGE_CATEGORIES = [
  'Currency',
  'Fragments',
  'Abyss',
  'UncutGems',
  'LineageSupportGems',
  'Essences',
  'SoulCores',
  'Idols',
  'Runes',
  'Ritual',
  'Expedition',
  'Delirium',
  'Breach',
  'Verisium',
] as const;

export type ExchangeCategory = (typeof EXCHANGE_CATEGORIES)[number];

/** An exchange item's category and what it is, as the price result names it. */
export interface ExchangeKind {
  category: ExchangeCategory;
  /** `a rune`, `a Distilled Emotion`, … */
  label: string;
}

/**
 * The comparison form of an item name: trimmed, spaces collapsed, typographic apostrophes made plain, accents
 * dropped (poe.ninja writes `Mórrigan's Insight` and `Oisín's Oath`, PoB `Morrigan's Insight` and `Oisin's Oath`),
 * lower case.
 */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** An exact-name test over folded names. */
function names(list: readonly string[]): (folded: string) => boolean {
  const set = new Set(list.map(foldName));
  return (folded) => set.has(folded);
}

/** A name test: a pattern over the folded name (lower case), or an exact-name set. */
type NameTest = RegExp | ((folded: string) => boolean);

interface KindRule extends ExchangeKind {
  test: NameTest;
}

/**
 * The lineage support gems: every gem `Data/Gems.lua` tags `lineage = true` at the pin (75), by PoB's names, and the
 * two more poe.ninja lists as lineage gems, which the pin has untagged (`Bhatair's Vengeance`, `Zarokh's Revolt`).
 * Their names follow no pattern. poe.ninja lists them in its exchange (`LineageSupportGems`), with the exchange's volumes, so they are
 * exchange items too (the spike; the user's list had them on the trade site).
 */
export const LINEAGE_SUPPORT_GEMS: readonly string[] = [
  "Bhatair's Vengeance", "Zarokh's Revolt",
  "Ahn's Citadel", "Ailith's Chimes", "Amanamu's Tithe", "Arakaali's Lust", "Arbiter's Ignition", "Arbiter's Reach",
  "Arjun's Medal", "Atalui's Bloodletting", "Atziri's Allure", "Atziri's Communion", "Atziri's Impatience",
  "Breachlord's Amalgam", "Breachlord's Rift", "Brutus' Brain", "Catha's Brilliance", "Cirel's Cultivation",
  "Daresso's Passion", "Dialla's Desire", "Doedre's Undoing", "Dominus' Grasp", "Einhar's Beastrite",
  "Eonyr's Thunder", "Esh's Prowess", "Esh's Radiance", "Garukhan's Resolve", "Guatelitzi's Ablation",
  "Hayoxi's Fulmination", "Helbrym's Hide", "Her Declaration", "Ixchel's Torment", "Kalisa's Crescendo",
  "Kaom's Madness", "Khatal's Rejuvenation", "Kulemak's Dominion", "Kurgal's Leash", "Medved's Felling",
  "Morgana's Tempest", "Morrigan's Insight", "Oisin's Oath", "Olroth's Conviction", "Olroth's Hubris",
  "Paquate's Pact", "Prototype Seventeen", "Rakiata's Flow", "Ratha's Assault", "Rigwald's Ferocity",
  "Romira's Requital", "Seraph's Heart", "Sione's Temper", "Styrn's Ferocity", "Styrn's Mountain", "Tacati's Ire",
  "Tangmazu's Thurible", "Tasalio's Rhythm", "Tawhoa's Tending", "Tecrod's Revenge", "Trickster's Shard",
  "Tul's Avalanche", "Tul's Stillness", "Uhtred's Augury", "Uhtred's Constellation", "Uhtred's Exodus",
  "Uhtred's Omen", "Uhtred's Rite", "Uruk's Smelting", "Uul-Netol's Embrace", "Varashta's Blessing",
  "Vilenta's Propulsion", "Vorana's Siege", "Vruun's Aftermath", "Vruun's Inevitability", "Xibaqua's Rending",
  "Xoph's Pyre", "Zarokh's Refrain", "Zerphi's Infamy",
];

/**
 * The uniques whose names match an exchange kind, by PoB's names (`Data/Uniques/*.lua` at the pin): uniques are
 * trade-site items, so these are never exchange items.
 */
export const UNIQUES_NAMED_LIKE_EXCHANGE_ITEMS: readonly string[] = ['Idol of Uldurn'];
const isUniqueNamedLikeExchangeItem = names(UNIQUES_NAMED_LIKE_EXCHANGE_ITEMS);

/**
 * The kinds, in order: the first that matches gives the category. Specific kinds come before general ones (`Liquid
 * Verisium` is Verisium, not an emotion; `Raven-Touched Shard` a soul core, `Trickster's Shard` a lineage gem).
 */
const KINDS: readonly KindRule[] = [
  { category: 'LineageSupportGems', label: 'a lineage support gem', test: names(LINEAGE_SUPPORT_GEMS) },
  // Verisium (the Runes of Aldur league): ores, alloys, crests.
  { category: 'Verisium', label: 'a Verisium item', test: /^(?:(?:exceptional|liquid) )?verisium$/ },
  { category: 'Verisium', label: 'an alloy', test: / alloy$/ },
  { category: 'Verisium', label: 'a starlit ore', test: / starlit ore$/ },
  { category: 'Verisium', label: 'a crest', test: /^[\w-]+'s crest of the [\w-]+$/ },
  // Delirium: the Distilled Emotions, every tier and the Ancient ones (`Data/LiquidEmotions.lua`).
  { category: 'Delirium', label: 'a Distilled Emotion', test: /^(?:ancient )?(?:(?:diluted|concentrated|potent) )?liquid [a-z]+$/ },
  // Essences, every tier (`Data/Essence.lua`).
  { category: 'Essences', label: 'an essence', test: /^(?:(?:lesser|greater|perfect) )?essence of (?:the )?[\w-]+$/ },
  { category: 'UncutGems', label: 'an uncut gem', test: /^uncut (?:skill|spirit|support) gem(?: \(level \d+\))?$/ },
  // Socketables (`Data/ModRunes.lua`): soul cores and congealed mist, idols, runes.
  { category: 'SoulCores', label: 'a soul core', test: /\bsoul core\b/ },
  { category: 'SoulCores', label: 'a soul core', test: /^[\w-]+'s thesis$/ },
  { category: 'SoulCores', label: 'a congealed mist', test: names(['Raven-Touched Shard']) },
  { category: 'Idols', label: 'an idol', test: / idol$|^idol of / },
  { category: 'Idols', label: 'an idol', test: /^carved [a-z]+$/ },
  { category: 'Runes', label: 'a rune', test: /\brune\b/ },
  { category: 'Runes', label: 'a rune', test: /^legacy of / },
  { category: 'Runes', label: 'a rune', test: /^[a-z]+ of aldur$|^aldur's legacy$|^emergent [a-z]+$/ },
  // The named runes whose names follow no pattern (`ModRunes.lua` and poe.ninja's Runes list the same nine).
  {
    category: 'Runes',
    label: 'a rune',
    test: names([
      "Astrid's Creativity", "Cadigan's Epiphany", "Katla's Gloom", "Kolr's Hunt", "Medved's Tending",
      "Serle's Triumph", "Thrud's Might", "Uhtred's Sidereus", "Vorana's Carnage",
    ]),
  },
  // Abyss: bones, and the abyssal eyes (`Data/ModRunes.lua` type `AbyssalEye`).
  { category: 'Abyss', label: 'an abyssal bone', test: /^[a-z]+ (?:collarbone|jawbone|rib|cranium)$/ },
  { category: 'Abyss', label: 'an abyssal eye', test: /^[\w-]+'s gaze$/ },
  { category: 'Breach', label: 'a catalyst', test: / catalyst$/ },
  { category: 'Breach', label: 'a Breach item', test: /^breach splinter$|breachstone$/ },
  { category: 'Ritual', label: 'an omen', test: /^omen of / },
  { category: 'Ritual', label: 'a Ritual item', test: names(['An Audience with the King', 'Head of the King', 'Sacred Bloom']) },
  { category: 'Expedition', label: 'an Expedition item', test: / flux(?: \(level \d+\))?$|^expedition logbook$|^[\w-]+'s saga$/ },
  { category: 'Fragments', label: 'a fragment', test: / reliquary key\b| crisis fragment$|^(?:cowardly|deadly|victorious) fate$/ },
  { category: 'Fragments', label: 'a fragment', test: /^origin (?:cradle|core|spark)$|^simulacrum(?: splinter)?$/ },
  {
    category: 'Fragments',
    label: 'a fragment',
    test: names(['Breachlord Sac', 'Call of the Shadows', "Kulemak's Invitation", "Raven's Reflection", 'The Triskelion Reforged', 'Shattered Triskelion']),
  },
  // Currency: orbs, shards, infusers and the rest.
  { category: 'Currency', label: 'a currency item', test: /^(?:(?:lesser|greater|perfect) )?orb of (?:alchemy|annulment|augmentation|chance|extraction|transmutation)$/ },
  {
    category: 'Currency',
    label: 'a currency item',
    test: /^(?:(?:lesser|greater|perfect) )?(?:exalted|chaos|divine|regal|vaal|vaal cultivation|fracturing|architect's|artificer's|jeweller's) orb$|^[\w-]+'s orb of sacrifice$| infuser$/,
  },
  {
    category: 'Currency',
    label: 'a currency item',
    test: names([
      "Artificer's Shard", 'Chance Shard', 'Transmutation Shard', 'Mirror of Kalandra', "Glassblower's Bauble",
      "Gemcutter's Prism", "Armourer's Scrap", "Blacksmith's Whetstone", 'Scroll of Wisdom', "Arcanist's Etcher",
      'Core Destabiliser', 'Crystallised Corruption', 'Cryptic Key', "Hinekora's Lock",
    ]),
  },
];

/** An item name's exchange category and kind, or null for an item the exchange doesn't sell (trade listings price it). */
export function exchangeKindOf(itemName: string): ExchangeKind | null {
  const folded = foldName(itemName);
  if (folded === '' || isUniqueNamedLikeExchangeItem(folded)) return null;
  const rule = KINDS.find((k) => (typeof k.test === 'function' ? k.test(folded) : k.test.test(folded)));
  return rule ? { category: rule.category, label: rule.label } : null;
}
