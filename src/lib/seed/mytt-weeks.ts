// Converts MyTT week strings into teaching-week WeekMasks. Pure TS (no DB, no Astro, no engine imports).
//
// Two input syntaxes are accepted:
//  - teaching weeks:  "1-8,10-12"
//  - MyTT raw dates:  "27/7-31/8, 21/9-28/9, 12/10-26/10", single dates "6/10", or lists "4/8, 18/8, 22/9-29/9".
//    A range means "every week from the first date to the last date, on the session's weekday", so both
//    ends (and every single date) must fall on that weekday. Year is taken from the term start date.

export type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export const DAY_NAMES: readonly DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface WeekTerm {
  /** ISO Monday of teaching week 1. */
  startDate: string;
  teachingWeeks: number;
  breakAfterWeek: number | null;
  /** Calendar weeks the break lasts. Default 2. */
  breakCalendarWeeks?: number;
}

export const MAX_WEEK_BIT = 13;
const DAY_MS = 86_400_000;

/** True when the string is MyTT raw-date syntax (contains a d/m date). */
export function isMyttDateString(text: string): boolean {
  return text.includes("/");
}

function isoToUtc(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`bad ISO date "${iso}"`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fmt(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** Weekday index of a UTC-midnight timestamp, 0 = Monday. */
function weekdayOf(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

/** UTC ms of the Monday of teaching week `n`. */
export function teachingWeekMonday(term: WeekTerm, n: number): number {
  const brk = term.breakCalendarWeeks ?? 2;
  const extra = term.breakAfterWeek !== null && n > term.breakAfterWeek ? brk : 0;
  return isoToUtc(term.startDate) + (n - 1 + extra) * 7 * DAY_MS;
}

/** ISO date (YYYY-MM-DD) of weekday `day` (0 = Mon) in teaching week `n`. */
export function teachingWeekDate(term: WeekTerm, n: number, day: number): string {
  return new Date(teachingWeekMonday(term, n) + day * DAY_MS).toISOString().slice(0, 10);
}

function parseDate(token: string, term: WeekTerm): number {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(token);
  if (!m) throw new Error(`bad date "${token}" (expected d/m)`);
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const startYear = new Date(isoToUtc(term.startDate)).getUTCFullYear();
  const startMonth = new Date(isoToUtc(term.startDate)).getUTCMonth() + 1;
  const year = mo < startMonth ? startYear + 1 : startYear;
  const ms = Date.UTC(year, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new Error(`no such date "${token}"`);
  return ms;
}

/** Map a date to its teaching week, or throw (break, before or after the term). */
function dateToTeachingWeek(ms: number, term: WeekTerm, token: string): number {
  for (let n = 1; n <= term.teachingWeeks; n++) {
    const mon = teachingWeekMonday(term, n);
    if (ms >= mon && ms < mon + 7 * DAY_MS) return n;
  }
  const first = teachingWeekMonday(term, 1);
  const last = teachingWeekMonday(term, term.teachingWeeks) + 7 * DAY_MS;
  if (ms < first || ms >= last) {
    throw new Error(`date ${token} is outside the term (${fmt(first)} to ${fmt(last - DAY_MS)})`);
  }
  throw new Error(`date ${token} falls in the mid-semester break`);
}

function parseTeachingWeeks(text: string, term: WeekTerm): number[] {
  const weeks = new Set<number>();
  for (const raw of text.split(",")) {
    const part = raw.trim();
    const m = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/.exec(part);
    if (!m) throw new Error(`bad teaching-week part "${part}" (expected e.g. "1-6,8-12")`);
    const lo = Number(m[1]);
    const hi = m[2] === undefined ? lo : Number(m[2]);
    if (hi < lo) throw new Error(`descending week range "${part}"`);
    if (lo < 1 || hi > term.teachingWeeks) {
      throw new Error(`week ${lo < 1 ? lo : hi} is outside teaching weeks 1..${term.teachingWeeks}`);
    }
    for (let w = lo; w <= hi; w++) weeks.add(w);
  }
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Convert a weeks string to sorted teaching-week numbers for a session on `day`.
 * Throws Error with a clear message when a date is on the wrong weekday, in the break or outside the term.
 */
export function myttWeekList(text: string, day: DayName, term: WeekTerm): number[] {
  const src = text.trim();
  if (src === "") throw new Error("empty weeks string");
  if (!isMyttDateString(src)) return parseTeachingWeeks(src, term);

  const dayIdx = DAY_NAMES.indexOf(day);
  if (dayIdx < 0) throw new Error(`unknown day "${day}"`);
  const weeks = new Set<number>();

  const checkDay = (ms: number, token: string) => {
    if (weekdayOf(ms) !== dayIdx) {
      throw new Error(`${token} is a ${DAY_NAMES[weekdayOf(ms)]}, not a ${day}`);
    }
  };

  for (const raw of src.split(",")) {
    const part = raw.trim();
    if (part === "") throw new Error(`empty item in "${text}"`);
    const bits = part.split("-").map((s) => s.trim());
    if (bits.length > 2) throw new Error(`bad date range "${part}"`);
    const a = parseDate(bits[0]!, term);
    checkDay(a, bits[0]!);
    const b = bits.length === 2 ? parseDate(bits[1]!, term) : a;
    if (bits.length === 2) checkDay(b, bits[1]!);
    if (b < a) throw new Error(`descending date range "${part}"`);
    for (let ms = a; ms <= b; ms += 7 * DAY_MS) {
      weeks.add(dateToTeachingWeek(ms, term, fmt(ms)));
    }
  }
  return [...weeks].sort((x, y) => x - y);
}

export function weeksToMask(weeks: readonly number[]): number {
  let mask = 0;
  for (const w of weeks) {
    if (w < 1 || w > MAX_WEEK_BIT) throw new Error(`week ${w} outside 1..${MAX_WEEK_BIT}`);
    mask |= 1 << (w - 1);
  }
  return mask;
}

/** Convert to a WeekMask (bit i-1 = teaching week i). */
export function myttWeeksToMask(text: string, day: DayName, term: WeekTerm): number {
  return weeksToMask(myttWeekList(text, day, term));
}

/** Compact "1-8,10-12" form of a week list. */
export function weekListToText(weeks: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i < weeks.length; ) {
    let j = i;
    while (j + 1 < weeks.length && weeks[j + 1] === weeks[j]! + 1) j++;
    out.push(j === i ? `${weeks[i]}` : `${weeks[i]}-${weeks[j]}`);
    i = j + 1;
  }
  return out.join(",");
}
