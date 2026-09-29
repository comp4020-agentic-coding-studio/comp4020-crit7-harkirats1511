import { describe, expect, it } from "vitest";
import { formatWeeks, parseWeeks, weekBit, weekList, weekToDate, weeksOverlap } from "./weeks";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("weeks", () => {
  it("parses and lists", () => {
    const m = parseWeeks("1-6,8-12");
    expect(weekList(m)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);
    expect(parseWeeks("")).toBe(0);
    expect(parseWeeks(" 3 , 5-6 ")).toBe(weekBit(3) | weekBit(5) | weekBit(6));
  });
  it("rejects malformed and out-of-range input", () => {
    for (const bad of ["0", "14", "a", "1-", "5-3", "1,,2", "1-14"]) {
      expect(() => parseWeeks(bad), bad).toThrow();
    }
    expect(() => weekBit(0)).toThrow();
    expect(() => weekBit(14)).toThrow();
  });
  it("formats compact ranges and round-trips", () => {
    expect(formatWeeks(parseWeeks("1-6,8-12"))).toBe("1-6,8-12");
    expect(formatWeeks(0)).toBe("");
    expect(formatWeeks(parseWeeks("3"))).toBe("3");
    expect(formatWeeks(parseWeeks("1,3,5-13"))).toBe("1,3,5-13");
  });
  it("formats human labels split at the break", () => {
    expect(formatWeeks(parseWeeks("2-6,7-8,10-12"), 6)).toBe("Wks 2-6, 7-8, 10-12");
    expect(formatWeeks(parseWeeks("2-8,10-12"), 6)).toBe("Wks 2-6, 7-8, 10-12");
    expect(formatWeeks(parseWeeks("1-12"), 6)).toBe("Wks 1-6, 7-12");
    expect(formatWeeks(parseWeeks("4"), 6)).toBe("Wk 4");
    expect(formatWeeks(parseWeeks("2-5"), null)).toBe("Wks 2-5");
    expect(formatWeeks(0, 6)).toBe("");
  });
  it("overlaps", () => {
    expect(weeksOverlap(parseWeeks("1-6"), parseWeeks("6-8"))).toBe(true);
    expect(weeksOverlap(parseWeeks("1-6"), parseWeeks("7-8"))).toBe(false);
    expect(weeksOverlap(0, parseWeeks("1-13"))).toBe(false);
  });
  it("maps weeks to dates across the break", () => {
    expect(iso(weekToDate("2026-07-27", 6, 1, 0))).toBe("2026-07-27");
    expect(iso(weekToDate("2026-07-27", 6, 6, 4))).toBe("2026-09-04");
    expect(iso(weekToDate("2026-07-27", 6, 7, 0))).toBe("2026-09-21");
    expect(iso(weekToDate("2026-07-27", 6, 12, 6))).toBe("2026-11-01");
    expect(iso(weekToDate("2026-07-27", null, 7, 0))).toBe("2026-09-07");
    expect(weekToDate("2026-07-27", 6, 1, 0).getUTCHours()).toBe(0);
  });
});
