import type { ItemSlot } from "../engine/schemas.js";

/**
 * The `get_items` slots PoB's UI shows (E8). `get_items` lists every slot control PoB creates,
 * including hidden ones: gear jewel sockets past the equipped item's socket count, unallocated tree
 * sockets, the inactive weapon set, and Ring 3 without the extra-ring flag. Consumers drop those.
 */
export function visibleItemSlots<T extends Pick<ItemSlot, "inactive" | "shown">>(items: readonly T[]): T[] {
  return items.filter((item) => !item.inactive && item.shown);
}
