import type { Day, WeekMask } from "./types";

export const WEEK_COUNT = 13;
/** Mask with weeks 1..13 set. */
export const ALL_WEEKS: WeekMask = (1 << WEEK_COUNT) - 1;

/** Calendar weeks the mid-semester break lasts. */
const BREAK_CALENDAR_WEEKS = 2;

/** Parse "1-6,8-12" into a mask; throws on weeks outside 1..13 or malformed input. */
export function parseWeeks(text: string): WeekMask {
  const src = text.trim();
  if (src === "") return 0;
  let mask = 0;
  for (const rawPart of src.split(",")) {
    const part = rawPart.trim();
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) throw new Error(`parseWeeks: malformed weeks "${text}" (bad part "${part}")`);
    const lo = Number(m[1]);
    const hi = m[2] === undefined ? lo : Number(m[2]);
    if (lo < 1 || hi > WEEK_COUNT) {
      throw new Error(`parseWeeks: week out of range 1..${WEEK_COUNT} in "${text}"`);
    }
    if (hi < lo) throw new Error(`parseWeeks: descending range "${part}" in "${text}"`);
    for (let w = lo; w <= hi; w++) mask |= 1 << (w - 1);
  }
  return mask;
}

/** Contiguous runs [lo, hi] of set weeks, optionally split so no run crosses the break. */
function runs(mask: WeekMask, breakAfterWeek: number | null): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let w = 1; w <= WEEK_COUNT + 1; w++) {
    const on = w <= WEEK_COUNT && (mask & (1 << (w - 1))) !== 0;
    const splitHere = start !== -1 && breakAfterWeek !== null && w === breakAfterWeek + 1;
    if (start !== -1 && (!on || splitHere)) {
      out.push([start, w - 1]);
      start = -1;
    }
    if (on && start === -1) start = w;
  }
  return out;
}

/**
 * Format a mask as compact ranges, "1-6,8-12"; empty mask -> "".
 *
 * With `breakAfterWeek` supplied (the term's mid-sem break position) the output is the human
 * teaching-week label: "Wks 2-6, 7-8, 10-12" ("Wk 3" for a single week). Runs are split at the break,
 * so a range that spans it shows as two ranges either side of the break ("2-6, 7-8" rather than "2-8").
 */
export function formatWeeks(mask: WeekMask, breakAfterWeek?: number | null): string {
  if (breakAfterWeek === undefined) {
    return runs(mask, null)
      .map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`))
      .join(",");
  }
  const rs = runs(mask, breakAfterWeek);
  if (rs.length === 0) return "";
  const body = rs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");
  const single = rs.length === 1 && rs[0][0] === rs[0][1];
  return `${single ? "Wk" : "Wks"} ${body}`;
}

/** Expand a mask into ascending week numbers. */
export function weekList(mask: WeekMask): number[] {
  const out: number[] = [];
  for (let w = 1; w <= WEEK_COUNT; w++) if (mask & (1 << (w - 1))) out.push(w);
  return out;
}

/** True iff the two masks share at least one week ((a & b) !== 0). */
export function weeksOverlap(a: WeekMask, b: WeekMask): boolean {
  return (a & b) !== 0;
}

/** Mask containing only `week` (1..13). */
export function weekBit(week: number): WeekMask {
  if (!Number.isInteger(week) || week < 1 || week > WEEK_COUNT) {
    throw new Error(`weekBit: week ${week} out of range 1..${WEEK_COUNT}`);
  }
  return 1 << (week - 1);
}

/**
 * Calendar date (UTC-midnight Date holding the local calendar date) of `day` in teaching `week`,
 * given the ISO Monday of week 1 and the break position; weeks after the break skip two calendar weeks
 * (the mid-semester break).
 */
export function weekToDate(
  termStartIso: string,
  breakAfterWeek: number | null,
  week: number,
  day: Day,
): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(termStartIso);
  if (!m) throw new Error(`weekToDate: bad ISO date "${termStartIso}"`);
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const shift = breakAfterWeek !== null && week > breakAfterWeek ? BREAK_CALENDAR_WEEKS : 0;
  const days = (week - 1 + shift) * 7 + day;
  return new Date(base + days * 86_400_000);
}
