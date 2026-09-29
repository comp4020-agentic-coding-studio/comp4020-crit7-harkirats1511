import type {
  Allocation,
  AutofixOptions,
  AutofixResult,
  Catalog,
  Prefs,
  SeatsUsed,
} from "./types";

/**
 * Branch-and-bound over only the groups involved in clashes: find a clash-free allocation with the fewest
 * moves (moves validated jointly, full options excluded except the student's own), tie-break by best
 * scorePrefs (skipped when prefs is null), stop at opts.nodeCap and report `capped`.
 */
export function autofix(
  alloc: Allocation,
  catalog: Catalog,
  seats: SeatsUsed,
  prefs: Prefs | null,
  opts?: AutofixOptions,
): AutofixResult {
  throw new Error("not implemented: autofix");
}
