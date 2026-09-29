import type { Day, WeekMask } from "./types";

export const WEEK_COUNT = 13;
/** Mask with weeks 1..13 set. */
export const ALL_WEEKS: WeekMask = (1 << WEEK_COUNT) - 1;

/** Parse "1-6,8-12" into a mask; throws on weeks outside 1..13 or malformed input. */
export function parseWeeks(text: string): WeekMask {
  throw new Error("not implemented: parseWeeks");
}

/** Format a mask as compact ranges, "1-6,8-12"; empty mask -> "". */
export function formatWeeks(mask: WeekMask): string {
  throw new Error("not implemented: formatWeeks");
}

/** Expand a mask into ascending week numbers. */
export function weekList(mask: WeekMask): number[] {
  throw new Error("not implemented: weekList");
}

/** True iff the two masks share at least one week ((a & b) !== 0). */
export function weeksOverlap(a: WeekMask, b: WeekMask): boolean {
  throw new Error("not implemented: weeksOverlap");
}

/** Mask containing only `week` (1..13). */
export function weekBit(week: number): WeekMask {
  throw new Error("not implemented: weekBit");
}

/**
 * Calendar date (UTC-midnight Date holding the local calendar date) of `day` in teaching `week`,
 * given the ISO Monday of week 1 and the break position; weeks after the break skip one calendar week.
 */
export function weekToDate(
  termStartIso: string,
  breakAfterWeek: number | null,
  week: number,
  day: Day,
): Date {
  throw new Error("not implemented: weekToDate");
}
