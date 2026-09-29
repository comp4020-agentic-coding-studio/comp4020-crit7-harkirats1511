import { weekList, weekToDate } from "./weeks";
import type { Allocation, Catalog, Session, Term } from "./types";

export interface IcsOptions {
  /** Calendar name (X-WR-CALNAME). */
  calName?: string;
  /** DTSTAMP source; default new Date(). Injected for deterministic tests. */
  now?: Date;
}

const TZID = "Australia/Canberra";

/** VTIMEZONE: AEST +10 all year, AEDT +11 from the first Sunday of October to the first Sunday of April. */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:STANDARD",
  "DTSTART:19700405T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU",
  "TZOFFSETFROM:+1100",
  "TZOFFSETTO:+1000",
  "TZNAME:AEST",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:19701004T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU",
  "TZOFFSETFROM:+1000",
  "TZOFFSETTO:+1100",
  "TZNAME:AEDT",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

/** Escape TEXT values per RFC 5545 section 3.3.11. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line so no line exceeds 75 octets (CRLF excluded); never splits a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curBytes + n > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74; // continuation lines carry a leading space
    }
    cur += ch;
    curBytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const p2 = (n: number) => String(n).padStart(2, "0");

function localStamp(date: Date, min: number): string {
  return (
    `${date.getUTCFullYear()}${p2(date.getUTCMonth() + 1)}${p2(date.getUTCDate())}` +
    `T${p2(Math.floor(min / 60))}${p2(min % 60)}00`
  );
}

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}` +
    `T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`
  );
}

const uidPart = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-");

interface Ev {
  sortKey: string;
  lines: string[];
}

/**
 * RFC 5545 calendar for the allocation: one VEVENT per session per running week (no RRULE, so the break is
 * correct), Australia/Canberra local times with a VTIMEZONE, CRLF line endings, 75-octet folding, stable UIDs.
 */
export function buildIcs(alloc: Allocation, catalog: Catalog, term: Term, opts?: IcsOptions): string {
  const stamp = utcStamp(opts?.now ?? new Date());
  const events: Ev[] = [];

  for (const [groupId, optionId] of alloc) {
    const option = catalog.options.get(optionId);
    const group = catalog.groups.get(groupId) ?? (option ? catalog.groups.get(option.groupId) : undefined);
    if (!option || !group) continue;
    const course = catalog.courses.get(group.courseId);
    const code = course?.code ?? group.courseId;
    for (const s of option.sessions as Session[]) {
      for (const week of weekList(s.weeks)) {
        const date = weekToDate(term.startDate, term.breakAfterWeek, week, s.day);
        const start = localStamp(date, s.startMin);
        const desc = [
          `${course?.title ?? code} - ${group.name} ${option.code}`,
          `Part: ${s.part}`,
          `Week: ${week}`,
          `Staff: ${option.staff ?? "Not published"}`,
        ];
        const lines = [
          "BEGIN:VEVENT",
          `UID:${uidPart(code)}-${uidPart(group.id)}-${uidPart(option.id)}-${uidPart(s.part)}-w${week}@mytimetable`,
          `DTSTAMP:${stamp}`,
          `DTSTART;TZID=${TZID}:${start}`,
          `DTEND;TZID=${TZID}:${localStamp(date, s.endMin)}`,
          `SUMMARY:${escapeText(`${code} ${group.name} ${option.code}`)}`,
          ...(s.location ? [`LOCATION:${escapeText(s.location)}`] : []),
          `DESCRIPTION:${escapeText(desc.join("\n"))}`,
          "END:VEVENT",
        ];
        events.push({ sortKey: `${start}|${code}|${group.id}|${option.id}|${s.part}`, lines });
      }
    }
  }
  events.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  const all = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//comp4020 crit7//Better MyTimetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts?.calName ?? `${term.name} timetable`)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
    ...events.flatMap((e) => e.lines),
    "END:VCALENDAR",
  ];
  return all.map(foldLine).join("\r\n") + "\r\n";
}
