// Formatting helpers shared by workstream H pages/components (draft, history, auto-fix, preferences).
import { className, primarySlot, range12, roomName, slotWhen, weeksWords } from "../lib/daybook";
import type { Catalog, ClashDetail, Group, Option, Term } from "../lib/engine/types";
import { DAY_NAMES } from "../lib/view";

export function courseCode(catalog: Catalog, group: Group | undefined, fallbackId: string): string {
  const c = group ? catalog.courses.get(group.courseId) : undefined;
  return c ? c.code : fallbackId.split("-")[0].toUpperCase();
}

/** "FINM1001 tutorial" */
export function groupLabel(catalog: Catalog, groupId: string): string {
  return catalog.groups.has(groupId) ? className(catalog, groupId) : groupId.toUpperCase();
}

/** The option as a time, "Wed 2–3:30pm" (or `none` for null). Students know a class by its time, not its code. */
export function optionCode(catalog: Catalog, optionId: string | null, none = "none"): string {
  if (optionId === null) return none;
  const o = catalog.options.get(optionId);
  const g = o && catalog.groups.get(o.groupId);
  const s = o && g ? primarySlot(o, g) : null;
  return s ? slotWhen(s) : optionId;
}

/** Every part of an option: "Wed 2–3:30pm, weeks 2–12, Fulton Muir 2.03" then "optional drop-in 3:30–4pm". */
export function optionSessions(_term: Term, o: Option | undefined): string[] {
  if (!o) return ["Not published"];
  return o.sessions.map((s) =>
    s.exempt
      ? `optional drop-in ${range12(s.startMin, s.endMin)}`
      : `${DAY_NAMES[s.day]} ${range12(s.startMin, s.endMin)}, ${weeksWords(s.weeks)}${s.location ? `, ${roomName(s.location)}` : ""}`,
  );
}

export function courseHref(catalog: Catalog, groupId: string, draftId?: string | null): string {
  const g = catalog.groups.get(groupId);
  const code = g ? courseCode(catalog, g, groupId) : groupId;
  return `/course/${encodeURIComponent(code)}/${draftId ? `?draftId=${encodeURIComponent(draftId)}` : ""}`;
}

/** One overlap in words: "Tue 1–2pm, weeks 1–12". */
export function overlapWords(_term: Term, c: ClashDetail): string[] {
  return c.overlaps.map((o) => `${DAY_NAMES[o.day]} ${range12(o.fromMin, o.toMin)}, ${weeksWords(o.weeks)}`);
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
  return d.toLocaleString("en-AU", { timeZone: "Australia/Canberra", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}
