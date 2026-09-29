import type {
  Allocation,
  Catalog,
  ClashDetail,
  Option,
  OptionState,
  SeatsUsed,
  Session,
  SessionClash,
} from "./types";

/** Overlap of two sessions (same day, overlapping minutes, shared week) or null. Adjacent (end == start) is no overlap. */
export function sessionOverlap(a: Session, b: Session): SessionClash | null {
  throw new Error("not implemented: sessionOverlap");
}

/** Every clashing session pair between two options, or null. Null if either option's group is exempt, or same option. */
export function optionClash(a: Option, b: Option, catalog: Catalog): ClashDetail | null {
  throw new Error("not implemented: optionClash");
}

/**
 * Clashes of `optionId` against the options in `alloc`, skipping the allocation entry for the
 * option's OWN group and any group in `ignoreGroupIds`. `optionA` of each result is `optionId`.
 */
export function clashesFor(
  optionId: string,
  alloc: Allocation,
  catalog: Catalog,
  ignoreGroupIds?: ReadonlySet<string>,
): ClashDetail[] {
  throw new Error("not implemented: clashesFor");
}

/** All clashes among the options in `alloc` (each unordered pair once). Used by dashboard and autofix. */
export function allClashes(alloc: Allocation, catalog: Catalog): ClashDetail[] {
  throw new Error("not implemented: allClashes");
}

/**
 * State of every option in `groupId` for this allocation. The student's own current option is
 * "yours" and is not counted against seats when judging `full` for OTHER options of that group.
 */
export function optionStates(
  groupId: string,
  alloc: Allocation,
  catalog: Catalog,
  seats: SeatsUsed,
): Map<string, OptionState> {
  throw new Error("not implemented: optionStates");
}
