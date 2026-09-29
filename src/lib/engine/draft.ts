import type { Allocation, DraftOverlay, Move } from "./types";

/** Real allocation with the overlay applied (null entries drop the group). Does not mutate inputs. */
export function effectiveAlloc(real: Allocation, overlay: DraftOverlay): Allocation {
  const out: Allocation = new Map(real);
  for (const [groupId, optionId] of overlay) {
    if (optionId === null) out.delete(groupId);
    else out.set(groupId, optionId);
  }
  return out;
}

/** Moves that turn `real` into `target`, one per differing group, ordered by groupId. */
export function diffAlloc(real: Allocation, target: Allocation): Move[] {
  const ids = new Set([...real.keys(), ...target.keys()]);
  const moves: Move[] = [];
  for (const groupId of [...ids].sort()) {
    const from = real.get(groupId) ?? null;
    const to = target.get(groupId) ?? null;
    if (from !== to) moves.push({ groupId, fromOptionId: from, toOptionId: to });
  }
  return moves;
}
