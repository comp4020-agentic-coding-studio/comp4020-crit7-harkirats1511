import type { Allocation, DraftOverlay, Move } from "./types";

/** Real allocation with the overlay applied (null entries drop the group). Does not mutate inputs. */
export function effectiveAlloc(real: Allocation, overlay: DraftOverlay): Allocation {
  throw new Error("not implemented: effectiveAlloc");
}

/** Moves that turn `real` into `target`, one per differing group, ordered by groupId. */
export function diffAlloc(real: Allocation, target: Allocation): Move[] {
  throw new Error("not implemented: diffAlloc");
}
