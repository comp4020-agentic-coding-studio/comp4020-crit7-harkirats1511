import type { Allocation, Catalog, ResolvePlan, SeatsUsed } from "./types";

/**
 * Given the wanted option A, return clash-free alternatives in A's group and, for each blocker B
 * (allocated options A clashes with), the options B could move to. Every candidate is checked with A
 * tentatively chosen and B's old slot removed (cascades caught); unsafe candidates are kept, flagged.
 * Safe candidates sort first, then non-full, then by option code.
 */
export function resolveClash(
  optionId: string,
  alloc: Allocation,
  catalog: Catalog,
  seats: SeatsUsed,
): ResolvePlan {
  throw new Error("not implemented: resolveClash");
}
