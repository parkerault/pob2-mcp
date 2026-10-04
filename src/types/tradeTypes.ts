// Path of Exile Trade API Type Definitions

// ========================================
// Trade Query Structures
// ========================================

export interface StatFilter {
  id: string;
  value?: {
    min?: number;
    max?: number;
  };
  disabled?: boolean;
}

export interface StatFilterGroup {
  type: 'and' | 'or' | 'not' | 'count' | 'if' | 'weight';
  filters: StatFilter[];
  value?: {
    min?: number;
    max?: number;
  };
  disabled?: boolean;
}

/** A `{min?, max?}` range filter. */
export interface RangeFilter {
  min?: number;
  max?: number;
}

/** An `{option}` filter (trade2 sends booleans as the strings "true"/"false"). */
export interface OptionFilter {
  option?: string;
}

/** trade2 filter groups (PoE2: no socket/link groups; rune sockets live under `equipment_filters`). */
export interface TradeFilters {
  trade_filters?: {
    filters?: {
      /** `option` is the trade currency id; without it the server reads Exalted Orb equivalent (A-10). */
      price?: RangeFilter & { option?: string };
      indexed?: OptionFilter;
      sale_type?: OptionFilter;
      collapse?: { option?: boolean };
    };
    disabled?: boolean;
  };
  type_filters?: {
    filters?: {
      rarity?: OptionFilter;
      category?: OptionFilter;
      ilvl?: RangeFilter;
      quality?: RangeFilter;
    };
    disabled?: boolean;
  };
  equipment_filters?: {
    filters?: {
      rune_sockets?: RangeFilter;
      ar?: RangeFilter;
      es?: RangeFilter;
      ev?: RangeFilter;
      block?: RangeFilter;
      dps?: RangeFilter;
      pdps?: RangeFilter;
      edps?: RangeFilter;
    };
    disabled?: boolean;
  };
  req_filters?: {
    filters?: {
      lvl?: RangeFilter;
      str?: RangeFilter;
      dex?: RangeFilter;
      int?: RangeFilter;
    };
    disabled?: boolean;
  };
  misc_filters?: {
    filters?: {
      corrupted?: OptionFilter;
      identified?: OptionFilter;
      mirrored?: OptionFilter;
    };
    disabled?: boolean;
  };
}

/** trade2 listing status: instant buyout, instant buyout or in person, online, online in league, any. */
export type TradeStatus = 'securable' | 'available' | 'online' | 'onlineleague' | 'any';

export interface TradeQuery {
  query: {
    status?: {
      option: TradeStatus;
    };
    name?: string;
    type?: string;
    term?: string;
    stats?: StatFilterGroup[];
    filters?: TradeFilters;
  };
  sort?: {
    price?: 'asc' | 'desc';
  };
}

// ========================================
// Trade API Response Structures
// ========================================

export interface SearchResult {
  id: string; // Search ID for fetching results
  complexity: number;
  result: string[]; // Array of item IDs
  total: number;
  inexact?: boolean;
}

export interface Property {
  name: string;
  values: Array<[string, number]>; // [value, type]
  displayMode: number;
  type?: number;
}

export interface Requirement {
  name: string;
  values: Array<[string, number]>;
  displayMode: number;
  suffix?: string;
}

export interface Socket {
  group: number;
  /** PoE2: `"rune"`. */
  type?: string;
}

/** One magnitude of a mod; trade2 sends `min`/`max` as strings. */
export interface ModMagnitude {
  hash?: string;
  min: string | number;
  max: string | number;
}

/** One affix behind a mod line (rare affixes carry name/tier/level; uniques only magnitudes). */
export interface ModInfo {
  name?: string;
  tier?: string;
  level?: number;
  magnitudes?: ModMagnitude[];
}

/** A trade2 mod line object (S-3 §1). `description` carries `[Tag|Text]` markup. */
export interface ModLineObject {
  description: string;
  flags?: { fractured?: boolean; desecrated?: boolean; crafted?: boolean };
  domain?: string;
  hash?: string;
  mods?: ModInfo[];
}

/** A mod line as trade2 sends it: an object on items, sometimes a plain string in `socketedItems`. */
export type RawModLine = string | ModLineObject;

export interface TradeItem {
  realm?: string;
  verified: boolean;
  w: number;
  h: number;
  icon: string;
  league: string;
  id: string;
  name: string;
  typeLine: string;
  baseType: string;
  identified: boolean;
  ilvl: number;
  note?: string;

  rarity?: string; // "Normal", "Magic", "Rare", "Unique"
  frameType: number;

  properties?: Property[];
  requirements?: Requirement[];

  sockets?: Socket[];
  /** Runes and gems in the item's sockets (gems have no `id`). */
  socketedItems?: Array<Partial<TradeItem> & { socket?: number; bondedMods?: RawModLine[] }>;

  // Mod lines. Fractured, desecrated and crafted lines sit inside `explicitMods` (flags + domain).
  implicitMods?: RawModLine[];
  explicitMods?: RawModLine[];
  enchantMods?: RawModLine[];
  runeMods?: RawModLine[];
  /** Weighted searches: `[{description: "Sum: <w>", domain: "pseudo", hash: "statgroup.0"}]`. */
  pseudoMods?: RawModLine[];
  craftedMods?: RawModLine[];
  fracturedMods?: RawModLine[];
  desecratedMods?: RawModLine[];

  extended?: {
    ar?: number;
    ev?: number;
    es?: number;
    ward?: number;
    /** `hashes.<domain>` = `[[statId, [modIndex…]]]`. */
    hashes?: Record<string, Array<[string, number[] | null]>>;
  };

  corrupted?: boolean;
  doubleCorrupted?: boolean;
  mirrored?: boolean;
  fractured?: boolean;
  desecrated?: boolean;
  mutated?: boolean;

  flavourText?: string[];
  descrText?: string;
  stackSize?: number;
  maxStackSize?: number;
}

export interface TradeAccount {
  name: string;
  lastCharacterName?: string;
  /** `null` on instant-buyout listings. */
  online?: {
    league?: string;
    status?: string;
  } | null;
  language?: string;
  realm?: string;
}

export interface TradePrice {
  type: string; // "~price", "~b/o"
  amount: number;
  /** The trade currency id ("exalted", "divine", "chaos", …); also the poe.ninja id (D-33). */
  currency: string;
}

export interface TradeListing {
  method: string;
  indexed: string;
  stash?: {
    name: string;
    x: number;
    y: number;
  };
  /** Only on in-person listings; instant-buyout listings have `fee` and `hideout_token` instead. */
  whisper?: string;
  whisper_token?: string;
  fee?: number;
  hideout_token?: string;
  account: TradeAccount;
  price?: TradePrice;
}

export interface ItemListing {
  id: string;
  listing: TradeListing;
  item: TradeItem;
}

export interface FetchResult {
  result: ItemListing[];
}

// ========================================
// Static Data Structures
// ========================================

export interface StatDefinition {
  id: string;
  text: string;
  type: string;
  option?: {
    options?: Array<{
      id: number;
      text: string;
    }>;
  };
}

export interface StatCategory {
  label: string;
  entries: StatDefinition[];
}

export interface StatData {
  result: StatCategory[];
}

export interface League {
  id: string;
  realm?: string;
  text?: string;
}

export interface LeagueData {
  result: League[];
}
