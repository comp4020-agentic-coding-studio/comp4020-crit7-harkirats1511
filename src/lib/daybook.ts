// Daybook view model: turns the catalog + allocation into what the redesigned pages show (a week of real classes,
// clashes per day, the other times of one class with honest reasons, ranked swaps). Pure: no DB or Astro imports,
// so it is unit-tested in daybook.test.ts. Clash truth always comes from the engine (optionStates / clashesFor);
// this file only arranges and words it.
import { clashesFor, optionStates } from "./engine/clash";
import type { Allocation, Catalog, ClashDetail, Course, Day, Group, Option, SeatsUsed, Session, Term, WeekMask } from "./engine/types";
import { weekToDate } from "./engine/weeks";

// ---------- words and times ----------

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
};
const ap = (m: number) => (Math.floor(m / 60) % 24 >= 12 ? "pm" : "am");

/** "9am", "12:30pm". */
export function time12(m: number): string {
  return clock(m) + ap(m);
}

/** "9–10:30am", "11am–12:30pm", "1–3:30pm" (12-hour, en dash, suffix once when both sides share it). */
export function range12(a: number, b: number): string {
  return ap(a) === ap(b) ? `${clock(a)}–${clock(b)}${ap(b)}` : `${time12(a)}–${time12(b)}`;
}

export function hourLabel(h: number): string {
  return `${h % 12 || 12}${h % 24 >= 12 ? "pm" : "am"}`;
}

/** Rewrite 24-hour "09:30" times inside engine-worded text as "9:30am". */
export function twelveHour(text: string): string {
  return text.replace(/(\d{1,2}):(\d{2})/g, (_, h: string, m: string) => time12(Number(h) * 60 + Number(m)));
}

/** "HH:MM" for <time datetime>. */
export function hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function seatsText(left: number | null): string {
  if (left === null) return "Seats not published";
  return left === 1 ? "1 seat left" : `${left} seats left`;
}

/** "30 September" from a UTC-midnight date. */
export function dateLabel(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * MyTimetable room text to what a student says: "Rm 2.03_Fulton Muir Bldg 95" -> "Fulton Muir 2.03",
 * "Lec Theatre_Copland Bldg 25" -> "Copland Lecture Theatre". Unrecognised text is returned tidied, never dropped.
 */
export function roomName(raw: string | null): string | null {
  if (!raw || raw.trim() === "" || /^n\/?a$/i.test(raw.trim())) return null;
  const [roomRaw, bldgRaw] = raw.split("_");
  if (bldgRaw === undefined) return raw.replace(/_/g, " ").trim();
  const bldg = bldgRaw
    .replace(/\s*Bldg\s*\w+$/i, "")
    .replace(/^[A-Z]{1,3}\s+(?=[A-Z][a-z])/, "")
    .replace(/\s+Cultural Centre$/i, "")
    .trim();
  const room = roomRaw
    .replace(/^Rms?\s+/i, "")
    .replace(/^Lec\s+Theatre/i, "Lecture Theatre")
    .replace(/\s+Rm\s+/i, " ")
    .trim();
  return `${bldg} ${room}`.trim();
}

/** "weeks 2–12", "week 9", "weeks 2, 4, 6–8 and 10" (the mid-semester break is not a gap a student counts). */
export function weeksWords(mask: WeekMask): string {
  const runs: [number, number][] = [];
  for (let w = 1; w <= 13; w++) {
    if (!(mask & (1 << (w - 1)))) continue;
    const last = runs.at(-1);
    if (last && last[1] === w - 1) last[1] = w;
    else runs.push([w, w]);
  }
  if (runs.length === 0) return "no weeks";
  const parts = runs.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`));
  const single = runs.length === 1 && runs[0][0] === runs[0][1];
  const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `${single ? "week" : "weeks"} ${body}`;
}

// ---------- courses and classes ----------

const HUES = ["c1", "c2", "c3", "c4"] as const;
export type Hue = (typeof HUES)[number];

/** One of four muted hues per course, stable by course code order. */
export function courseHue(catalog: Catalog, courseId: string): Hue {
  const ids = [...catalog.courses.values()].sort((a, b) => a.code.localeCompare(b.code)).map((c) => c.id);
  const i = ids.indexOf(courseId);
  return HUES[(i < 0 ? 0 : i) % HUES.length];
}

/** "Lecture", "Tutorial", "Workshop", "Computer lab", "Drop-in". */
export function kindWord(group: Group): string {
  switch (group.kind) {
    case "lecture":
      return "Lecture";
    case "tutorial":
      return "Tutorial";
    case "workshop":
      return "Workshop";
    case "lab":
      return /^com/i.test(group.name) ? "Computer lab" : "Lab";
    case "dropin":
      return "Drop-in";
    default:
      return group.name;
  }
}

/** "COMP3900 tutorial" */
export function className(catalog: Catalog, groupId: string): string {
  const g = catalog.groups.get(groupId);
  const c = g && catalog.courses.get(g.courseId);
  if (!g || !c) return groupId;
  return `${c.code} ${kindWord(g).toLowerCase()}`;
}

export const isExempt = (s: Session, g: Group) => s.exempt || g.exemptFromClash;

/** Options a student can actually pick: overflow clones (same slot, no room) are hidden. */
export function realOptions(group: Group): Option[] {
  return group.options.filter((o) => !o.overflow);
}

// ---------- slots: an option's sessions as a student sees them ----------

/** A main session with its optional drop-in tail merged in (P1 + P2 shown as one option). */
export interface Slot {
  day: Day;
  start: number;
  end: number;
  /** End of an optional drop-in straight after the class, or null. */
  tailEnd: number | null;
  weeks: WeekMask;
  room: string | null;
  /** The whole slot is optional (a drop-in on its own). */
  optional: boolean;
}

/** Merge each exempt session that starts when a main session ends (same day) into that session as its tail. */
export function toSlots(sessions: Session[], group: Group): Slot[] {
  const mains = sessions.filter((s) => !isExempt(s, group));
  const extras = sessions.filter((s) => isExempt(s, group));
  const used = new Set<Session>();
  const out: Slot[] = mains.map((m) => {
    const tail = extras.find((e) => !used.has(e) && e.day === m.day && e.startMin === m.endMin);
    if (tail) used.add(tail);
    return { day: m.day, start: m.startMin, end: m.endMin, tailEnd: tail ? tail.endMin : null, weeks: m.weeks, room: roomName(m.location), optional: false };
  });
  for (const e of extras) {
    if (!used.has(e)) out.push({ day: e.day, start: e.startMin, end: e.endMin, tailEnd: null, weeks: e.weeks, room: roomName(e.location), optional: true });
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start);
}

const bits = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};

/** The slot that describes the option best: the non-optional one that runs in the most weeks. */
export function primarySlot(option: Option, group: Group): Slot | null {
  const slots = toSlots(option.sessions, group);
  const pool = slots.some((s) => !s.optional) ? slots.filter((s) => !s.optional) : slots;
  return pool.reduce<Slot | null>((best, s) => (!best || bits(s.weeks) > bits(best.weeks) ? s : best), null);
}

/** "Wed 2–3:30pm" */
export function slotWhen(s: Pick<Slot, "day" | "start" | "end">): string {
  return `${DAY_SHORT[s.day]} ${range12(s.start, s.end)}`;
}

/** Extra patterns beyond the primary slot, e.g. "Tue 2–3:30pm in week 9". Empty for a simple option. */
export function otherPatterns(option: Option, group: Group): string[] {
  const p = primarySlot(option, group);
  return toSlots(option.sessions, group)
    .filter((s) => !s.optional && s !== p && !(p && s.day === p.day && s.start === p.start && s.end === p.end))
    .map((s) => `${slotWhen(s)} in ${weeksWords(s.weeks)}`);
}

// ---------- today and the teaching week ----------

export interface Clock {
  /** Local (Canberra) calendar date at UTC midnight. */
  date: Date;
  /** Minutes since local midnight. */
  min: number;
}

/** Now in Canberra. APP_NOW ("2026-09-29T11:40", local time) pins it for local screenshots and tests. */
export function nowInCanberra(now: Date = new Date(), pinned: string | undefined = process.env.APP_NOW): Clock {
  const m = pinned ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(pinned) : null;
  if (m) return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), min: +m[4] * 60 + +m[5] };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Canberra", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day)), min: (+parts.hour % 24) * 60 + +parts.minute };
}

export interface WeekView {
  week: number;
  /** Today's weekday (0 = Mon) when today is a teaching day of this week, else null. */
  today: Day | null;
  /** Day to show first: today, else Monday. */
  defaultDay: Day;
  /** Dates of Mon..Sun of this week. */
  dates: Date[];
  /** Why this is not the current week, if it is not ("Mid-semester break"). */
  note: string | null;
}

/** The teaching week a student cares about on `clock`: this week on a weekday, next week at the weekend or in the break. */
export function weekView(term: Term, now: Clock): WeekView {
  const [y, mo, d] = term.startDate.split("-").map(Number);
  const days = Math.floor((now.date.getTime() - Date.UTC(y, mo - 1, d)) / 86_400_000);
  const brk = term.breakAfterWeek;
  let week: number;
  let today: Day | null = null;
  let note: string | null = null;
  if (days < 0) {
    week = 1;
    note = `Teaching starts ${dateLabel(weekToDate(term.startDate, brk, 1, 0))}`;
  } else {
    const cw = Math.floor(days / 7);
    const dow = days - cw * 7;
    if (brk !== null && cw >= brk && cw < brk + 2) {
      week = brk + 1;
      note = "Mid-semester break";
    } else {
      week = brk !== null && cw >= brk + 2 ? cw - 1 : cw + 1;
      if (dow >= 5) week += 1;
      else today = dow as Day;
    }
    if (week > term.teachingWeeks) {
      week = term.teachingWeeks;
      today = null;
      note = "Teaching has finished";
    }
  }
  const dates = [0, 1, 2, 3, 4, 5, 6].map((dd) => weekToDate(term.startDate, brk, week, dd as Day));
  return { week, today, defaultDay: today ?? 0, dates, note };
}

/** "tue" -> 1; anything else -> null. */
export function parseDay(v: string | null): Day | null {
  if (!v) return null;
  const i = DAY_KEYS.indexOf(v.toLowerCase() as (typeof DAY_KEYS)[number]);
  return i >= 0 && i <= 4 ? (i as Day) : null;
}

/** "8" -> 8 when it's a whole teaching week (1..term.teachingWeeks); anything else (missing, not an integer, out of range) -> null. */
export function parseWeek(v: string | null, term: Term): number | null {
  if (v === null || !/^\d+$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return n >= 1 && n <= term.teachingWeeks ? n : null;
}

export interface WeekNav {
  /** The week a "previous" link would land on, or null when `week` is the first teaching week. */
  prev: number | null;
  /** The week a "next" link would land on, or null when `week` is the last teaching week. */
  next: number | null;
  /** True when `week` is the week the student would land on today (the value `weekView` returns). */
  isCurrent: boolean;
  /** True when `week` is the first teaching week after the mid-semester break. */
  breakBefore: boolean;
  /** True when `week` is the last teaching week before the mid-semester break. */
  breakAfter: boolean;
  /** "Week 8" */
  label: string;
  /** "28 September to 2 October" (Monday to Friday of `week`). */
  dates: string;
}

/** Stepping between teaching weeks around `week`, clamped to 1..term.teachingWeeks, with the mid-semester break named honestly. */
export function weekNav(term: Term, week: number, currentWeek: number): WeekNav {
  const brk = term.breakAfterWeek;
  const mon = weekToDate(term.startDate, brk, week, 0);
  const fri = weekToDate(term.startDate, brk, week, 4);
  return {
    prev: week > 1 ? week - 1 : null,
    next: week < term.teachingWeeks ? week + 1 : null,
    isCurrent: week === currentWeek,
    breakBefore: brk !== null && week === brk + 1,
    breakAfter: brk !== null && week === brk,
    label: `Week ${week}`,
    dates: `${dateLabel(mon)} to ${dateLabel(fri)}`,
  };
}

// ---------- the week's classes ----------

export interface DayEvent {
  key: string;
  optionId: string;
  groupId: string;
  course: Course;
  hue: Hue;
  kind: string;
  day: Day;
  start: number;
  end: number;
  tailEnd: number | null;
  room: string | null;
  optional: boolean;
}

const runsIn = (s: Session, week: number) => (s.weeks & (1 << (week - 1))) !== 0;

/** The student's classes that actually run in teaching week `week`, drop-in tails merged. */
export function weekEvents(alloc: Allocation, catalog: Catalog, week: number): DayEvent[] {
  const out: DayEvent[] = [];
  for (const [groupId, optionId] of alloc) {
    const group = catalog.groups.get(groupId);
    const option = catalog.options.get(optionId);
    const course = group && catalog.courses.get(group.courseId);
    if (!group || !option || !course) continue;
    toSlots(
      option.sessions.filter((s) => runsIn(s, week)),
      group,
    ).forEach((s, i) =>
      out.push({
        key: `${optionId}:${i}`,
        optionId,
        groupId,
        course,
        hue: courseHue(catalog, course.id),
        kind: kindWord(group),
        day: s.day,
        start: s.start,
        end: s.end,
        tailEnd: s.tailEnd,
        room: s.room,
        optional: s.optional || group.exemptFromClash,
      }),
    );
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start || a.end - b.end);
}

export interface DayClash {
  a: DayEvent;
  b: DayEvent;
  day: Day;
  from: number;
  to: number;
}

/** Overlaps between non-optional classes (drop-ins never clash). */
export function eventClashes(events: DayEvent[]): DayClash[] {
  const out: DayClash[] = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.optional || b.optional || a.day !== b.day || a.groupId === b.groupId) continue;
      if (a.start < b.end && b.start < a.end) out.push({ a, b, day: a.day, from: Math.max(a.start, b.start), to: Math.min(a.end, b.end) });
    }
  }
  return out;
}

/** "FINM1001 lecture" for an event. */
export const eventName = (e: DayEvent) => `${e.course.code} ${e.kind.toLowerCase()}`;

// ---------- lane layout (side-by-side overlapping blocks) ----------

export interface Laned<T> {
  item: T;
  a: number;
  b: number;
  lane: number;
  lanes: number;
}

export function layoutLanes<T>(spans: { item: T; a: number; b: number }[]): Laned<T>[] {
  const items: Laned<T>[] = spans.map((s) => ({ ...s, lane: 0, lanes: 1 })).sort((x, y) => x.a - y.a || y.b - x.b);
  let cluster: Laned<T>[] = [];
  let end = -1;
  const flush = () => {
    const ends: number[] = [];
    for (const it of cluster) {
      let l = ends.findIndex((e) => e <= it.a);
      if (l < 0) l = ends.length;
      ends[l] = it.b;
      it.lane = l;
    }
    for (const it of cluster) it.lanes = ends.length;
    cluster = [];
    end = -1;
  };
  for (const it of items) {
    if (cluster.length && it.a >= end) flush();
    cluster.push(it);
    end = Math.max(end, it.b);
  }
  if (cluster.length) flush();
  return items;
}

// ---------- one class and its other times ----------

export interface Judgement {
  option: Option;
  slot: Slot | null;
  /** "Wed 4–5:30pm" */
  when: string;
  /** Extra patterns ("Tue 2–3:30pm in week 9"). */
  extra: string[];
  held: boolean;
  legal: boolean;
  full: boolean;
  seatsLeft: number | null;
  /** Short honest reason when not legal: "Full", "Overlaps your COMP4020 tutorial (which can't move)". */
  reason: string | null;
  /** Informational note on a legal time: "Overlaps your optional COMP4650 drop-in". */
  info: string | null;
  clashes: ClashDetail[];
}

export interface Mobility {
  movable: boolean;
  /** "every other time is full", "it runs once", "every other time is full or overlaps another class". */
  why: string;
}

/** Can the class in `groupId` move to another real time without a clash or a full room? */
export function mobility(groupId: string, alloc: Allocation, catalog: Catalog, seats: SeatsUsed): Mobility {
  const group = catalog.groups.get(groupId);
  if (!group) return { movable: false, why: "it no longer exists" };
  const held = alloc.get(groupId);
  const others = realOptions(group).filter((o) => o.id !== held);
  if (others.length === 0) return { movable: false, why: "it runs once" };
  const st = optionStates(groupId, alloc, catalog, seats);
  const ok = others.filter((o) => {
    const s = st.get(o.id);
    return s && !s.full && s.clashes.length === 0;
  });
  if (ok.length) return { movable: true, why: "" };
  const allFull = others.every((o) => st.get(o.id)?.full);
  return { movable: false, why: allFull ? "every other time is full" : "every other time is full or overlaps another class" };
}

/** Held drop-ins (optional) overlapping the option's main sessions, as info text. */
function optionalOverlap(option: Option, group: Group, alloc: Allocation, catalog: Catalog): string | null {
  const mine = option.sessions.filter((s) => !isExempt(s, group));
  for (const [gid, oid] of alloc) {
    if (gid === group.id) continue;
    const g = catalog.groups.get(gid);
    const o = catalog.options.get(oid);
    if (!g || !o) continue;
    for (const s of o.sessions) {
      if (!isExempt(s, g)) continue;
      if (mine.some((m) => m.day === s.day && (m.weeks & s.weeks) !== 0 && m.startMin < s.endMin && s.startMin < m.endMin)) {
        return `Overlaps your optional ${catalog.courses.get(g.courseId)?.code ?? ""} drop-in`.replace("  ", " ");
      }
    }
  }
  return null;
}

/** Every real option of a group judged against the student's other classes (clash truth from the engine). */
export function judgeGroup(groupId: string, alloc: Allocation, catalog: Catalog, seats: SeatsUsed): Judgement[] {
  const group = catalog.groups.get(groupId);
  if (!group) return [];
  const held = alloc.get(groupId) ?? null;
  const states = optionStates(groupId, alloc, catalog, seats);
  const moveCache = new Map<string, Mobility>();
  const mob = (gid: string) => {
    if (!moveCache.has(gid)) moveCache.set(gid, mobility(gid, alloc, catalog, seats));
    return moveCache.get(gid)!;
  };
  return realOptions(group)
    .map((option): Judgement => {
      const st = states.get(option.id);
      const slot = primarySlot(option, group);
      const isHeld = option.id === held;
      const full = !isHeld && Boolean(st?.full);
      const clashes = isHeld ? [] : (st?.clashes ?? []);
      let reason: string | null = null;
      if (full) reason = "Full";
      else if (clashes.length) {
        const c = clashes[0];
        const optWeeks = option.sessions.filter((s) => !isExempt(s, group)).reduce((m, s) => m | s.weeks, 0);
        const inWeeks = c.weeks !== optWeeks ? ` in ${weeksWords(c.weeks)}` : "";
        const m = mob(c.groupB);
        reason = `Overlaps your ${className(catalog, c.groupB)}${inWeeks}${m.movable ? "" : " (which can’t move)"}`;
        if (clashes.length > 1) reason += ` and ${plural(clashes.length - 1, "other class", "other classes")}`;
      }
      return {
        option,
        slot,
        when: slot ? slotWhen(slot) : "Not published",
        extra: otherPatterns(option, group),
        held: isHeld,
        legal: !isHeld && !full && clashes.length === 0,
        full,
        seatsLeft: st?.seatsLeft ?? null,
        reason,
        info: isHeld ? null : optionalOverlap(option, group, alloc, catalog),
        clashes,
      };
    })
    .sort((a, b) => (a.slot?.day ?? 9) - (b.slot?.day ?? 9) || (a.slot?.start ?? 0) - (b.slot?.start ?? 0));
}

/**
 * Held classes that block some time of this group and cannot themselves move although they have other times
 * ("that class can't move: every other time is full"). A class that runs once is left out: nobody expects to move it.
 */
export function stuckBlockers(judged: Judgement[], alloc: Allocation, catalog: Catalog, seats: SeatsUsed): { groupId: string; why: string }[] {
  const seen = new Map<string, Mobility>();
  for (const j of judged) {
    if (j.full) continue;
    for (const c of j.clashes) if (!seen.has(c.groupB)) seen.set(c.groupB, mobility(c.groupB, alloc, catalog, seats));
  }
  return [...seen].filter(([, m]) => !m.movable && m.why !== "it runs once").map(([groupId, m]) => ({ groupId, why: m.why }));
}

// ---------- swap a time: rank and explain ----------

export type Tone = "good" | "warn" | "neutral";
export interface SwapCard {
  j: Judgement;
  badge: string;
  why: { tone: Tone; text: string }[];
}

export const SWAP_RULE = "No overlaps first, then most seats to spare.";

/** Legal times ranked by SWAP_RULE (no overlap at all, then most seats), with reasons computed from the week. */
export function rankSwaps(judged: Judgement[], events: DayEvent[], groupId: string): SwapCard[] {
  const held = judged.find((j) => j.held)?.slot ?? null;
  const others = events.filter((e) => e.groupId !== groupId && !e.optional);
  type Span = { start: number; end: number };
  const span = (day: number, mine: Slot | null): Span | null => {
    const list: Span[] = others.filter((e) => e.day === day);
    if (mine && mine.day === day) list.push(mine);
    return list.length ? { start: Math.min(...list.map((x) => x.start)), end: Math.max(...list.map((x) => x.end)) } : null;
  };
  return judged
    .filter((j) => j.legal && j.slot)
    .sort((a, b) => Number(Boolean(a.info)) - Number(Boolean(b.info)) || (b.seatsLeft ?? -1) - (a.seatsLeft ?? -1) || a.slot!.day - b.slot!.day || a.slot!.start - b.slot!.start)
    .slice(0, 3)
    .map((j) => {
      const s = j.slot!;
      const D = DAY_LONG[s.day];
      const why: SwapCard["why"] = [];
      why.push(j.info ? { tone: "warn", text: j.info } : { tone: "good", text: "Nothing overlaps it" });
      if (j.seatsLeft === 1) why.push({ tone: "warn", text: "Last seat, so it could go before you swap" });
      if (held && held.day === s.day) why.push({ tone: "good", text: `Still ${D}, so no new trip` });
      else if (span(s.day, null)) why.push({ tone: "good", text: `You’re on campus ${D} anyway` });
      else why.push({ tone: "warn", text: `Adds a trip to campus on ${D}` });
      if (held) {
        const H = DAY_LONG[held.day];
        const before = span(held.day, held);
        const after = span(held.day, held.day === s.day ? s : null);
        if (!after) why.push({ tone: "good", text: `Frees up ${H}` });
        else if (before && after.start > before.start) why.push({ tone: "good", text: `${H} starts at ${time12(after.start)} instead of ${time12(before.start)}` });
        else if (before && after.end < before.end) why.push({ tone: "good", text: `${H} ends at ${time12(after.end)} instead of ${time12(before.end)}` });
        if (held.day === s.day && before && after && after.end > before.end) why.push({ tone: "neutral", text: `${H} ends at ${time12(after.end)} instead of ${time12(before.end)}` });
      }
      if (!held || held.day !== s.day) {
        const was = span(s.day, null);
        const now = span(s.day, s);
        if (was && now && (now.start < was.start || now.end > was.end)) why.push({ tone: "neutral", text: `${D} would run ${time12(now.start)} to ${time12(now.end)}` });
      }
      return { j, badge: j.info ? "Overlaps a drop-in" : "No overlaps", why: why.slice(0, 4) };
    });
}

// ---------- the one problem on the home page ----------

export interface Problem {
  clash: DayClash;
  /** A group the student could change to clear it, or null when nothing can move. */
  fixGroupId: string | null;
  /** Total clashes this week (the card states one; the rest are counted). */
  count: number;
}

/** First clash of the week and whether any real move clears it (engine clash checks, seats respected). */
export function weekProblem(events: DayEvent[], alloc: Allocation, catalog: Catalog, seats: SeatsUsed): Problem | null {
  const clashes = eventClashes(events);
  if (!clashes.length) return null;
  const c = clashes[0];
  let fixGroupId: string | null = null;
  for (const e of [c.a, c.b]) {
    const group = catalog.groups.get(e.groupId);
    if (!group) continue;
    const st = optionStates(e.groupId, alloc, catalog, seats);
    const fits = realOptions(group).some((o) => o.id !== e.optionId && !st.get(o.id)?.full && clashesFor(o.id, alloc, catalog).length === 0);
    if (fits) {
      fixGroupId = e.groupId;
      break;
    }
  }
  return { clash: c, fixGroupId, count: clashes.length };
}
