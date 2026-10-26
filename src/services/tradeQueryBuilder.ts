import type { TradeQuery, TradeFilters, TradeStatus, StatFilterGroup } from '../types/tradeTypes.js';

/**
 * Free-text item types → trade2 `type_filters.filters.category` options.
 *
 * The PoE2 ids follow PoB2's `TradeHelpers.getTradeCategory` (pinned tag). PoB maps charms to
 * `flask`: trade2 has no charm-only category it knows of, so a charm search is a flask search.
 * Anything not in the map is sent as a base type (`query.type`).
 */
export const CATEGORY_MAP: Readonly<Record<string, string>> = {
  // Armour
  'body armour': 'armour.chest',
  chest: 'armour.chest',
  helmet: 'armour.helmet',
  gloves: 'armour.gloves',
  boots: 'armour.boots',
  shield: 'armour.shield',
  buckler: 'armour.buckler',
  focus: 'armour.focus',
  quiver: 'armour.quiver',
  // Accessories
  ring: 'accessory.ring',
  amulet: 'accessory.amulet',
  belt: 'accessory.belt',
  // Jewels, flasks, charms
  jewel: 'jewel',
  flask: 'flask',
  'life flask': 'flask.life',
  'mana flask': 'flask.mana',
  charm: 'flask',
  // Weapons
  weapon: 'weapon',
  'one hand weapon': 'weapon.one',
  'two hand weapon': 'weapon.twomelee',
  bow: 'weapon.bow',
  crossbow: 'weapon.crossbow',
  claw: 'weapon.claw',
  dagger: 'weapon.dagger',
  wand: 'weapon.wand',
  sceptre: 'weapon.sceptre',
  staff: 'weapon.staff',
  quarterstaff: 'weapon.warstaff',
  warstaff: 'weapon.warstaff',
  spear: 'weapon.spear',
  flail: 'weapon.flail',
  talisman: 'weapon.talisman',
  'one hand sword': 'weapon.onesword',
  'two hand sword': 'weapon.twosword',
  'one hand axe': 'weapon.oneaxe',
  'two hand axe': 'weapon.twoaxe',
  'one hand mace': 'weapon.onemace',
  'two hand mace': 'weapon.twomace',
  'fishing rod': 'weapon.rod',
};

type FilterGroup = keyof TradeFilters;

/**
 * Builder for trade2 search bodies (`POST /api/trade2/search/poe2/<league>`).
 *
 * PoE2 has no links or socket colours: there is no `socket_filters` group. Rune sockets are
 * `equipment_filters.filters.rune_sockets`.
 */
export class TradeQueryBuilder {
  private query: TradeQuery = {
    query: {
      status: { option: 'available' },
      filters: {},
    },
  };

  /** The `filters` object of a filter group, created on first use. */
  private group<G extends FilterGroup>(name: G): NonNullable<NonNullable<TradeFilters[G]>['filters']> {
    const filters = (this.query.query.filters ??= {});
    const group = (filters[name] ??= {} as NonNullable<TradeFilters[G]>) as { filters?: object };
    return (group.filters ??= {}) as NonNullable<NonNullable<TradeFilters[G]>['filters']>;
  }

  /** Item name (uniques). */
  withName(name: string): this {
    this.query.query.name = name;
    return this;
  }

  /**
   * A base type, as given, with no category mapping: a stackable item's name, such as a rune's (trade2 lists one with
   * `typeLine` = `baseType` = its name; D-444's trade fallback).
   */
  withBaseType(type: string): this {
    this.query.query.type = type;
    return this;
  }

  /** A generic item type maps to its category; anything else is a base type. */
  withType(type: string): this {
    const category = CATEGORY_MAP[type.trim().toLowerCase()];
    if (category) this.withCategory(category);
    else this.query.query.type = type;
    return this;
  }

  withCategory(category: string): this {
    this.group('type_filters').category = { option: category };
    return this;
  }

  /** `any` leaves rarity unfiltered. */
  withRarity(rarity: string): this {
    if (rarity !== 'any') this.group('type_filters').rarity = { option: rarity };
    return this;
  }

  withOnlineStatus(status: TradeStatus): this {
    this.query.query.status = { option: status };
    return this;
  }

  /**
   * Price range. `currency` is the trade currency id; without it trade2 reads the range as Exalted
   * Orb equivalent (A-10).
   */
  withPriceRange(min: number | undefined, max: number | undefined, currency?: string): this {
    this.group('trade_filters').price = {
      ...(currency ? { option: currency } : {}),
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    };
    return this;
  }

  /** Minimum rune sockets (D-51h). */
  withMinRuneSockets(min: number): this {
    this.group('equipment_filters').rune_sockets = { min };
    return this;
  }

  withCorrupted(corrupted: boolean): this {
    this.group('misc_filters').corrupted = { option: corrupted ? 'true' : 'false' };
    return this;
  }

  withIdentified(identified: boolean): this {
    this.group('misc_filters').identified = { option: identified ? 'true' : 'false' };
    return this;
  }

  /** An `and` group of trade stat ids with optional min/max. */
  withStats(stats: Array<{ id: string; min?: number; max?: number }>): this {
    const group: StatFilterGroup = {
      type: 'and',
      filters: stats.map((stat) => ({
        id: stat.id,
        value: {
          ...(stat.min !== undefined ? { min: stat.min } : {}),
          ...(stat.max !== undefined ? { max: stat.max } : {}),
        },
      })),
    };
    (this.query.query.stats ??= []).push(group);
    return this;
  }

  withSort(field: 'price', order: 'asc' | 'desc'): this {
    this.query.sort = { [field]: order };
    return this;
  }

  /** The search body (a deep copy). */
  build(): TradeQuery {
    return JSON.parse(JSON.stringify(this.query)) as TradeQuery;
  }
}
