import { describe, expect, it } from "vitest";
import { allClashes, clashesFor, optionClash, optionStates, sessionOverlap } from "./clash";
import { makeCatalog } from "./fixture.test-util";
import type { Allocation, SeatsUsed } from "./types";
import { formatWeeks } from "./weeks";

const one = (id: string, day: 0 | 1 | 2 | 3 | 4, start: string, end: string, weeks = "1-12", extra = {}) => ({
  id,
  ...extra,
  sessions: [{ day, start, end, weeks }],
});

describe("sessionOverlap / optionClash", () => {
  const cat = makeCatalog([
    {
      id: "g1",
      options: [
        one("a", 2, "10:00", "12:00"),
        one("adj", 2, "12:00", "13:00"),
        one("wk", 2, "10:00", "12:00", "13"),
        one("other-day", 3, "10:00", "12:00"),
        one("half", 2, "11:00", "13:00"),
      ],
    },
  ]);
  const o = (id: string) => cat.options.get(id)!;

  it("overlapping same slot clashes with minutes and window", () => {
    const c = sessionOverlap(o("a").sessions[0], o("half").sessions[0])!;
    expect(c.minutes).toBe(60);
    expect([c.fromMin, c.toMin]).toEqual([660, 720]);
    expect(formatWeeks(c.weeks)).toBe("1-12");
  });
  it("adjacent (end == start) does not clash", () => {
    expect(sessionOverlap(o("a").sessions[0], o("adj").sessions[0])).toBeNull();
    expect(optionClash(o("a"), o("adj"), cat)).toBeNull();
  });
  it("same slot on disjoint weeks does not clash", () => {
    expect(optionClash(o("a"), o("wk"), cat)).toBeNull();
  });
  it("different day does not clash", () => {
    expect(optionClash(o("a"), o("other-day"), cat)).toBeNull();
  });
  it("same option never clashes with itself", () => {
    expect(optionClash(o("a"), o("a"), cat)).toBeNull();
  });
});

describe("multi-part options and exemptions", () => {
  const cat = makeCatalog([
    {
      id: "multi",
      options: [
        {
          id: "m1",
          sessions: [
            { part: "P1", day: 0, start: "09:00", end: "10:00", weeks: "1-6" },
            { part: "P2", day: 3, start: "14:00", end: "16:00", weeks: "7-12" },
          ],
        },
      ],
    },
    {
      id: "hitsP1",
      options: [one("x1", 0, "09:30", "10:30", "5-6")],
    },
    {
      id: "hitsP2",
      options: [one("x2", 3, "15:00", "17:00", "8-9")],
    },
    {
      id: "hitsBoth",
      options: [
        {
          id: "x3",
          sessions: [
            { day: 3, start: "13:00", end: "14:30", weeks: "7" },
            { day: 0, start: "08:00", end: "09:15", weeks: "1" },
          ],
        },
      ],
    },
    {
      id: "misses",
      options: [one("x4", 0, "09:30", "10:30", "7-12")],
    },
    {
      // bundled 0.5 hr drop-in inside a tutorial option
      id: "tutWithDropIn",
      options: [
        {
          id: "t1",
          sessions: [
            { part: "P1", day: 2, start: "11:00", end: "12:30", weeks: "2-12" },
            { part: "P2", day: 0, start: "09:00", end: "09:30", weeks: "2-12", exempt: true },
          ],
        },
      ],
    },
    { id: "hitsDropIn", options: [one("d1", 0, "09:00", "09:30", "2-12")] },
    { id: "hitsTutPart", options: [one("d2", 2, "12:00", "13:00", "2-12")] },
    { id: "dropinGroup", exempt: true, options: [one("e1", 2, "11:00", "12:30", "2-12")] },
  ]);
  const o = (id: string) => cat.options.get(id)!;

  it("clashes if either part hits, explaining each pair", () => {
    const p1 = optionClash(o("m1"), o("x1"), cat)!;
    expect(p1.overlaps).toHaveLength(1);
    expect(p1.overlaps[0].a.part).toBe("P1");
    expect(p1.totalMinutes).toBe(30);
    expect(formatWeeks(p1.weeks)).toBe("5-6");

    const p2 = optionClash(o("m1"), o("x2"), cat)!;
    expect(p2.overlaps[0].a.part).toBe("P2");
    expect(p2.totalMinutes).toBe(60);
    expect(formatWeeks(p2.weeks)).toBe("8-9");
  });
  it("does not clash when parts miss on days/weeks", () => {
    expect(optionClash(o("m1"), o("x4"), cat)).toBeNull();
  });
  it("reports every overlapping pair, ordered by day then start", () => {
    const c = optionClash(o("x3"), o("m1"), cat);
    // x3 P1 (Thu 13:00-14:30 wk7) vs m1 P2 (Thu 14:00-16:00 wk7-12): 30 min. x3 P2 wk1 Mon 8:00-9:15 vs m1 P1 Mon 9:00-10:00 wk1-6: 15 min
    expect(c!.overlaps.map((p) => [p.day, p.minutes])).toEqual([
      [0, 15],
      [3, 30],
    ]);
    expect(c!.totalMinutes).toBe(45);
    expect(formatWeeks(c!.weeks)).toBe("1,7");
    expect(c!.optionA).toBe("x3");
    expect(c!.groupB).toBe("multi");
  });
  it("exempt bundled drop-in session is ignored in both directions, rest of option still clashes", () => {
    expect(optionClash(o("t1"), o("d1"), cat)).toBeNull();
    expect(optionClash(o("d1"), o("t1"), cat)).toBeNull();
    const c = optionClash(o("t1"), o("d2"), cat)!;
    expect(c.totalMinutes).toBe(30);
    expect(optionClash(o("d2"), o("t1"), cat)!.totalMinutes).toBe(30);
  });
  it("group.exemptFromClash exempts every session either way", () => {
    expect(optionClash(o("t1"), o("e1"), cat)).toBeNull();
    expect(optionClash(o("e1"), o("t1"), cat)).toBeNull();
  });
});

describe("clashesFor / allClashes / optionStates", () => {
  const cat = makeCatalog([
    { id: "A", options: [one("a1", 0, "09:00", "10:00"), one("a2", 1, "09:00", "10:00")] },
    {
      id: "B",
      options: [
        one("b1", 0, "09:30", "10:30", "1-12", { capacity: 2 }),
        one("b2", 2, "09:00", "10:00", "1-12", { capacity: null }),
        one("b3", 3, "09:00", "10:00", "1-12", { capacity: 1 }),
        one("b4", 0, "09:45", "10:15", "1-12", { capacity: 1 }),
      ],
    },
    { id: "C", options: [one("c1", 1, "09:30", "10:30")] },
  ]);
  const alloc: Allocation = new Map([
    ["A", "a1"],
    ["B", "b1"],
    ["C", "c1"],
  ]);

  it("clashesFor skips own group and ignored groups", () => {
    expect(clashesFor("a1", alloc, cat).map((c) => c.optionB)).toEqual(["b1"]);
    expect(clashesFor("a1", alloc, cat, new Set(["B"]))).toEqual([]);
    expect(clashesFor("a2", alloc, cat).map((c) => c.optionB)).toEqual(["c1"]);
    expect(clashesFor("a2", alloc, cat).every((c) => c.optionA === "a2")).toBe(true);
    expect(clashesFor("nope", alloc, cat)).toEqual([]);
  });
  it("allClashes reports each pair once", () => {
    const all = allClashes(alloc, cat);
    expect(all.map((c) => [c.optionA, c.optionB])).toEqual([["a1", "b1"]]);
    expect(allClashes(new Map(), cat)).toEqual([]);
  });
  it("optionStates precedence and seats", () => {
    const seats: SeatsUsed = new Map([
      ["b1", 2],
      ["b2", 500],
      ["b3", 1],
      ["b4", 1],
    ]);
    const s = optionStates("B", alloc, cat, seats);
    // own option is yours and never full even at capacity
    expect(s.get("b1")).toMatchObject({ kind: "yours", full: false, seatsLeft: 0, clashes: [] });
    // capacity null: never full, seatsLeft null
    expect(s.get("b2")).toMatchObject({ kind: "select", full: false, seatsLeft: null });
    // full, no clash
    expect(s.get("b3")).toMatchObject({ kind: "full", full: true, seatsLeft: 0 });
    // clash beats full, and both reported
    const b4 = s.get("b4")!;
    expect(b4.kind).toBe("clash");
    expect(b4.full).toBe(true);
    expect(b4.clashes.map((c) => c.optionB)).toEqual(["a1"]);
  });
  it("optionStates with empty group allocation and unknown group", () => {
    const s = optionStates("A", new Map(), cat, new Map());
    expect([...s.values()].map((x) => x.kind)).toEqual(["select", "select"]);
    expect(optionStates("zzz", alloc, cat, new Map()).size).toBe(0);
  });
});
