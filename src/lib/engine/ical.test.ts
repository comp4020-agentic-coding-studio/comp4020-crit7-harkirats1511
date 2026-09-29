import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "./ical";
import { weekList } from "./weeks";
import type { Allocation, Catalog, Group, Option, Session, Term } from "./types";

const term: Term = { id: "t", name: "S2 2026", startDate: "2026-07-27", teachingWeeks: 12, breakAfterWeek: 6 };
const mask = (...w: number[]) => w.reduce((m, x) => m | (1 << (x - 1)), 0);
const W = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function session(id: string, part: string, day: 0 | 1 | 2 | 3 | 4, s: number, e: number, weeks: number[], loc: string | null, exempt = false): Session {
  return { id, optionId: "o1", part, day, startMin: s, endMin: e, weeks: mask(...weeks), location: loc, exempt };
}

function build(sessions: Session[], staff: string | null = "Dr A, B; C") {
  const option: Option = { id: "o1", groupId: "g1", code: "01", capacity: 20, campus: null, staff, overflow: false, sessions };
  const group: Group = { id: "g1", courseId: "c1", kind: "tutorial", name: "Tut A", exemptFromClash: false, options: [option] };
  const catalog: Catalog = {
    terms: new Map([[term.id, term]]),
    courses: new Map([["c1", { id: "c1", termId: "t", code: "COMP4020", title: "Studio", aliases: [], groups: [group] }]]),
    groups: new Map([["g1", group]]),
    options: new Map([["o1", option]]),
    groupsByCourse: new Map([["c1", ["g1"]]]),
  };
  const alloc: Allocation = new Map([["g1", "o1"]]);
  return buildIcs(alloc, catalog, term, { now: new Date("2026-07-01T00:00:00Z") });
}

function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, "").split("\r\n").filter((l) => l !== "");
}
function events(ics: string) {
  const out: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  for (const l of unfold(ics)) {
    if (l === "BEGIN:VEVENT") cur = {};
    else if (l === "END:VEVENT") { out.push(cur!); cur = null; }
    else if (cur) { const i = l.indexOf(":"); cur[l.slice(0, i).split(";")[0]] = l.slice(i + 1); if (l.startsWith("DTSTART")) cur.TZID = /TZID=([^:]+)/.exec(l)?.[1] ?? ""; }
  }
  return out;
}
const dtstarts = (ics: string) => events(ics).map((e) => e.DTSTART);

describe("buildIcs", () => {
  const ics = build([session("s1", "P1", 0, 540, 600, W, "Bldg 1, Rm 2")]);

  it("is structurally valid", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    const lines = unfold(ics);
    for (const k of ["VCALENDAR", "VEVENT", "VTIMEZONE", "STANDARD", "DAYLIGHT"]) {
      expect(lines.filter((l) => l === `BEGIN:${k}`).length).toBe(lines.filter((l) => l === `END:${k}`).length);
    }
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    for (const e of events(ics)) {
      for (const p of ["UID", "DTSTAMP", "DTSTART", "DTEND", "SUMMARY"]) expect(e[p]).toBeTruthy();
      expect(e.TZID).toBe("Australia/Canberra");
    }
    expect(lines).toContain("TZNAME:AEDT");
    expect(lines).toContain("TZNAME:AEST");
    expect(ics).not.toContain("RRULE:FREQ=WEEKLY");
  });

  it("has sessions x weeks events with unique stable UIDs", () => {
    const evs = events(ics);
    expect(evs.length).toBe(12);
    expect(new Set(evs.map((e) => e.UID)).size).toBe(12);
    expect(evs[0].UID).toBe("COMP4020-g1-o1-P1-w1@mytimetable");
    expect(evs[0].SUMMARY).toBe("COMP4020 Tut A 01");
    expect(evs[0].DTSTAMP).toBe("20260701T000000Z");
    const two = build([session("s1", "P1", 0, 540, 600, [1, 2, 3], null), session("s2", "P2", 2, 540, 600, [2, 3], "X")]);
    expect(events(two).length).toBe(5);
  });

  it("leaves a real two-week gap for the mid-sem break", () => {
    const d = dtstarts(ics).map((s) => s.slice(0, 8));
    expect(d).not.toContain("20260907");
    expect(d).not.toContain("20260914");
    expect(d).toContain("20260831"); // week 6 Monday, last before the two-week break
    expect(d).toContain("20260921"); // week 7 Monday
  });

  it("includes exempt drop-ins", () => {
    expect(events(build([session("s1", "P1", 1, 600, 660, [1, 2], null, true)])).length).toBe(2);
  });

  it("escapes text and folds long lines at 75 octets", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
    const loc = "Building, Level; " + "long location é ".repeat(15);
    const out = build([session("s1", "P1", 0, 540, 600, [1], loc)]);
    for (const raw of out.split("\r\n")) expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(75);
    const l = unfold(out).find((x) => x.startsWith("LOCATION:"))!;
    expect(l).toContain("Building\\, Level\; ");
    expect(l.replace(/\\([,;\\n])/g, "$1").slice(9)).toBe(loc);
    expect(unfold(out).find((x) => x.startsWith("DESCRIPTION:"))).toContain("Staff: Dr A\\, B\; C");
    const f = foldLine("X:" + "é".repeat(100));
    expect(f.split("\r\n").every((p) => new TextEncoder().encode(p).length <= 75)).toBe(true);
    expect(f.replace(/\r\n /g, "")).toBe("X:" + "é".repeat(100));
  });

  it("shifts UTC across the October daylight-saving change (4 Oct 2026, between weeks 8 and 9)", () => {
    const utcOf = (stamp: string) => {
      // Resolve local Canberra wall time to a UTC instant by trying AEST/AEDT offsets against Intl.
      const [y, mo, d, h, mi] = [+stamp.slice(0, 4), +stamp.slice(4, 6), +stamp.slice(6, 8), +stamp.slice(9, 11), +stamp.slice(11, 13)];
      for (const off of [10, 11]) {
        const t = Date.UTC(y, mo - 1, d, h - off, mi);
        const back = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Canberra", hour: "2-digit", minute: "2-digit", hour12: false, day: "2-digit" }).formatToParts(t);
        const get = (k: string) => +back.find((p) => p.type === k)!.value % (k === "hour" ? 24 : 1000);
        if (get("hour") === h && get("minute") === mi && get("day") === d) return new Date(t);
      }
      throw new Error("unresolved " + stamp);
    };
    const starts = dtstarts(ics);
    const w8 = starts.find((s) => s.startsWith("20260928"))!; // week 8 Monday
    const w9 = starts.find((s) => s.startsWith("20261005"))!; // week 9 Monday (first after the change)
    expect(w8.endsWith("T090000")).toBe(true);
    expect(w9.endsWith("T090000")).toBe(true); // wall clock unchanged
    expect(utcOf(w8).getUTCHours()).toBe(23); // 09:00 AEST = 23:00Z prev day
    expect(utcOf(w9).getUTCHours()).toBe(22); // 09:00 AEDT = 22:00Z prev day
  });

  it("parses back to the expected teaching weeks", () => {
    const weeks = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12];
    const out = build([session("s1", "P1", 2, 600, 660, weeks, null)]);
    const start = Date.UTC(2026, 6, 27);
    const got = dtstarts(out).map((s) => {
      const t = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
      let cal = Math.round((t - start) / (7 * 86400000)); // calendar weeks since week 1
      const dow = new Date(t).getUTCDay(); // Wed = 3
      expect(dow).toBe(3);
      if (cal >= 8) cal -= 2; // two-week break (7 and 14 Sep)
      return cal + 1;
    });
    expect(got).toEqual(weeks);
    expect(got).toEqual(weekList(mask(...weeks)));
  });
});
