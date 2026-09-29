import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { myttWeekList, myttWeeksToMask, teachingWeekDate, weekListToText, weeksToMask, type DayName, type WeekTerm } from "./mytt-weeks.ts";

const term: WeekTerm = { startDate: "2026-07-27", teachingWeeks: 12, breakAfterWeek: 6 };
const text = (s: string, d: DayName) => weekListToText(myttWeekList(s, d, term));

describe("term calendar", () => {
  it("puts the Mondays where MyTT does", () => {
    expect(teachingWeekDate(term, 1, 0)).toBe("2026-07-27");
    expect(teachingWeekDate(term, 6, 0)).toBe("2026-08-31");
    expect(teachingWeekDate(term, 7, 0)).toBe("2026-09-21");
    expect(teachingWeekDate(term, 9, 0)).toBe("2026-10-05");
    expect(teachingWeekDate(term, 12, 0)).toBe("2026-10-26");
  });
});

describe("every distinct MyTT string in the data", () => {
  const cases: Array<[string, DayName, string]> = [
    ["27/7-31/8, 21/9-28/9, 12/10-26/10", "Mon", "1-8,10-12"],
    ["3/8-31/8, 21/9-28/9, 12/10-26/10", "Mon", "2-8,10-12"],
    ["28/7-1/9, 22/9-27/10", "Tue", "1-12"],
    ["4/8-1/9, 22/9-27/10", "Tue", "2-12"],
    ["5/8-2/9, 23/9-28/10", "Wed", "2-12"],
    ["12/8-2/9, 23/9-28/10", "Wed", "3-12"],
    ["30/7-3/9, 24/9-29/10", "Thu", "1-12"],
    ["6/8-3/9, 24/9-29/10", "Thu", "2-12"],
    ["7/8-4/9, 25/9-30/10", "Fri", "2-12"],
    ["6/10", "Tue", "9"],
    ["7/10", "Wed", "9"],
    ["4/8, 18/8, 1/9, 22/9-29/9, 13/10", "Tue", "2,4,6-8,10"],
    ["6/8, 20/8, 3/9, 24/9-1/10, 15/10", "Thu", "2,4,6-8,10"],
    ["7/8, 21/8, 4/9, 25/9-2/10, 16/10", "Fri", "2,4,6-8,10"],
  ];
  for (const [s, d, want] of cases) {
    it(`${d} "${s}" => ${want}`, () => expect(text(s, d)).toBe(want));
  }

  it("covers every weeks string in seed/sem2-2026.json", () => {
    const seed = JSON.parse(readFileSync("seed/sem2-2026.json", "utf8"));
    const known = new Set(cases.map(([s]) => s));
    for (const c of seed.courses)
      for (const g of c.groups)
        if (Array.isArray(g.options))
          for (const o of g.options) for (const s of o.sessions) expect(known, `${s.day} ${s.weeks}`).toContain(s.weeks);
  });

  it("produces bitmasks (Mon skips Labour Day week 9)", () => {
    expect(myttWeeksToMask("27/7-31/8, 21/9-28/9, 12/10-26/10", "Mon", term)).toBe(weeksToMask([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12]));
    expect(myttWeeksToMask("6/10", "Tue", term)).toBe(1 << 8);
  });
});

describe("teaching-week strings", () => {
  it("still accepts them", () => {
    expect(text("1-8,10-12", "Mon")).toBe("1-8,10-12");
    expect(myttWeeksToMask("2", "Wed", term)).toBe(2);
  });
  it("rejects weeks beyond the term", () => {
    expect(() => myttWeekList("1-13", "Mon", term)).toThrow(/outside teaching weeks 1\.\.12/);
    expect(() => myttWeekList("0-3", "Mon", term)).toThrow(/outside/);
    expect(() => myttWeekList("5-3", "Mon", term)).toThrow(/descending/);
  });
});

describe("errors", () => {
  it("wrong weekday", () => {
    expect(() => myttWeekList("28/7-1/9", "Mon", term)).toThrow(/28\/7 is a Tue, not a Mon/);
    expect(() => myttWeekList("5/10", "Tue", term)).toThrow(/is a Mon, not a Tue/);
  });
  it("dates in the break", () => {
    expect(() => myttWeekList("8/9", "Tue", term)).toThrow(/mid-semester break/);
  });
  it("dates outside the term", () => {
    expect(() => myttWeekList("20/7", "Mon", term)).toThrow(/outside the term/);
    expect(() => myttWeekList("2/11", "Mon", term)).toThrow(/outside the term/);
  });
  it("malformed", () => {
    expect(() => myttWeekList("", "Mon", term)).toThrow();
    expect(() => myttWeekList("31/2", "Mon", term)).toThrow(/no such date/);
    expect(() => myttWeekList("3/8-1/9-2/9", "Mon", term)).toThrow(/bad date range/);
    expect(() => myttWeekList("31/8-3/8", "Mon", term)).toThrow(/descending/);
    expect(() => myttWeekList("3/8,, 10/8", "Mon", term)).toThrow(/empty item/);
  });
});
