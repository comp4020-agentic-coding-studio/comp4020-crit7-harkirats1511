// Formatting helpers shared by workstream H pages/components (draft, history, auto-fix, preferences).
import { formatWeeks } from "../lib/engine/weeks";
import type { Catalog, ClashDetail, Group, Option, Term } from "../lib/engine/types";
import { DAY_NAMES, fmtRange } from "../lib/view";

export function courseCode(catalog: Catalog, group: Group | undefined, fallbackId: string): string {
  const c = group ? catalog.courses.get(group.courseId) : undefined;
  return c ? c.code : fallbackId.split("-")[0].toUpperCase();
}

/** "FINM1001 Tut A" */
export function groupLabel(catalog: Catalog, groupId: string): string {
  const g = catalog.groups.get(groupId);
  if (!g) return groupId.toUpperCase();
  return `${courseCode(catalog, g, groupId)} ${g.name}`;
}

/** "03" (or "none" for null) */
export function optionCode(catalog: Catalog, optionId: string | null, none = "none"): string {
  if (optionId === null) return none;
  const o = catalog.options.get(optionId);
  return o ? o.code + (o.overflow ? " (overflow)" : "") : optionId;
}

/** Every session of an option: "Wed 10:30-12:00, Wks 1-6, 7-12". Multi-part options list each part. */
export function optionSessions(term: Term, o: Option | undefined): string[] {
  if (!o) return ["Not published"];
  return o.sessions.map((s) => {
    const part = o.sessions.length > 1 ? `${s.part} ` : "";
    return `${part}${DAY_NAMES[s.day]} ${fmtRange(s)}, ${formatWeeks(s.weeks, term.breakAfterWeek)}${s.location ? `, ${s.location}` : ""}`;
  });
}

export function courseHref(catalog: Catalog, groupId: string, draftId?: string | null): string {
  const g = catalog.groups.get(groupId);
  const code = g ? courseCode(catalog, g, groupId) : groupId;
  return `/course/${encodeURIComponent(code)}/${draftId ? `?draftId=${encodeURIComponent(draftId)}` : ""}`;
}

/** One overlap in words: "Tue 10:00-11:00 (60 min), Wks 1-6, 7-12". */
export function overlapWords(term: Term, c: ClashDetail): string[] {
  return c.overlaps.map(
    (o) => `${DAY_NAMES[o.day]} ${fmtRange({ startMin: o.fromMin, endMin: o.toMin })} (${o.minutes} min), ${formatWeeks(o.weeks, term.breakAfterWeek)}`,
  );
}

const SOURCE_WORDS: Record<string, string> = {
  select: "Selected",
  drop: "Dropped",
  move: "Moved",
  swap: "Swapped",
  draft: "Applied draft",
  autofix: "Auto-fix",
  undo: "Undo",
  waitlist: "Waitlist",
};
export function sourceWords(source: string): string {
  return SOURCE_WORDS[source] ?? source;
}

/** SQLite "YYYY-MM-DD HH:MM:SS" is UTC; ISO strings carry their own zone. Render in Canberra time. */
export function fmtWhen(createdAt: string): string {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(createdAt) ? createdAt.replace(" ", "T") + "Z" : createdAt;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleString("en-AU", { timeZone: "Australia/Canberra", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}
