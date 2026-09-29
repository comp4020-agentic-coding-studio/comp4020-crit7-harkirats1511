import { describe, expect, it } from "vitest";
import { clashesFor } from "./clash";
import { makeCatalog } from "./fixture.test-util";
import { resolveClash } from "./resolve";
import type { Allocation, SeatsUsed } from "./types";
import { formatWeeks } from "./weeks";

const one = (id: string, day: 0 | 1 | 2 | 3 | 4, start: string, end: string, weeks = "1-12", capacity: number | null = 10) => ({
  id,
  code: id.split("-").pop()!,
  capacity,
  sessions: [{ day, start, end, weeks }],
});

describe("resolveClash: real scenario", () => {
  const cat = makeCatalog([
    {
      id: "comp3900-tuta",
      options: [
        {
          id: "comp3900-tuta-04",
          code: "04",
          sessions: [
            { part: "P1", day: 2, start: "11:00", end: "12:30", weeks: "2-12" },
            { part: "P2", day: 4, start: "09:00", end: "09:30", weeks: "2-12", exempt: true },
          ],
        },
        one("comp3900-tuta-05", 3, "11:00", "12:30", "2-12"),
      ],
    },
    {
      id: "comp4020-tuta",
      options: [
        one("comp4020-tuta-03", 2, "09:00", "10:30", "2-12"),
        one("comp4020-tuta-04", 2, "10:30", "12:00", "2-12"),
        // moving here would clash with FINM (Tue 12:00-14:00)?  no: Fri
        one("comp4020-tuta-05", 4, "13:00", "14:30", "2-12"),
        one("comp4020-tuta-06", 1, "14:30", "15:30", "2-12"), // clashes with COMP4650 lec (Tue 13:00-15:30)
        one("comp4020-tuta-07", 3, "10:00", "11:00", "2-12", 5),
      ],
    },
    { id: "finm1001-leca", options: [one("finm1001-leca-01", 1, "12:00", "14:00", "1-12")] },
    { id: "comp4650-leca", options: [one("comp4650-leca-01", 1, "13:00", "15:30", "1-12")] },
  ]);
  const alloc: Allocation = new Map([
    ["comp4020-tuta", "comp4020-tuta-04"],
    ["finm1001-leca", "finm1001-leca-01"],
    ["comp4650-leca", "comp4650-leca-01"],
  ]);
  const seats: SeatsUsed = new Map([["comp4020-tuta-07", 5]]);

  it("COMP3900 TutA 04 clashes with allocated COMP4020 TutA 04 for 60 minutes", () => {
    const plan = resolveClash("comp3900-tuta-04", alloc, cat, seats);
    expect(plan.clashes).toHaveLength(1);
    const c = plan.clashes[0];
    expect(c.optionB).toBe("comp4020-tuta-04");
    expect(c.totalMinutes).toBe(60);
    expect(c.overlaps).toHaveLength(1); // the exempt drop-in adds nothing
    expect(formatWeeks(c.weeks)).toBe("2-12");
    expect(plan.blockerMoves).toHaveLength(1);
    const bm = plan.blockerMoves[0];
    expect(bm.groupId).toBe("comp4020-tuta");
    expect(bm.currentOptionId).toBe("comp4020-tuta-04");
    const byId = new Map(bm.candidates.map((x) => [x.optionId, x]));
    expect(byId.has("comp4020-tuta-04")).toBe(false);
    // tuta-03 (Wed 9-10:30) is safe; 05 (Fri) safe; 06 clashes with COMP4650 lecture (cascade); 07 is full
    expect(byId.get("comp4020-tuta-03")!.safe).toBe(true);
    expect(byId.get("comp4020-tuta-05")!.safe).toBe(true);
    const u = byId.get("comp4020-tuta-06")!;
    expect(u.safe).toBe(false);
    expect(u.newClashes.map((x) => x.optionB)).toEqual(["comp4650-leca-01"]);
    expect(byId.get("comp4020-tuta-07")).toMatchObject({ safe: true, full: true, seatsLeft: 0 });
    // sorted safe non-full first, then safe full, then unsafe
    expect(bm.candidates.map((x) => x.optionId)).toEqual([
      "comp4020-tuta-03",
      "comp4020-tuta-05",
      "comp4020-tuta-07",
      "comp4020-tuta-06",
    ]);
  });

  it("FINM1001 LecA vs COMP4650 LecA clash 60 min weeks 1-12", () => {
    const c = clashesFor("finm1001-leca-01", alloc, cat)[0];
    expect(c.optionB).toBe("comp4650-leca-01");
    expect(c.totalMinutes).toBe(60);
    expect(formatWeeks(c.weeks)).toBe("1-12");
  });
});

describe("resolveClash: cascades and alternatives", () => {
  // A wants Mon 9-10. Currently B Mon 9:30-10:30 blocks. B's other options: b2 hits C, b3 free.
  const cat = makeCatalog([
    {
      id: "A",
      options: [
        one("A-a1", 0, "09:00", "10:00"),
        one("A-a2", 1, "09:00", "10:00"), // clashes with C
        one("A-a3", 2, "09:00", "10:00", "1-12", 1), // full
        one("A-a4", 3, "09:00", "10:00"), // free, current
      ],
    },
    {
      id: "B",
      options: [
        one("B-b1", 0, "09:30", "10:30"),
        one("B-b2", 1, "09:30", "10:30"), // hits C
        one("B-b3", 4, "09:30", "10:30"),
        one("B-b4", 0, "09:00", "10:00"), // still clashes with A (chosen)
      ],
    },
    { id: "C", options: [one("C-c1", 1, "09:00", "11:00")] },
  ]);
  const alloc: Allocation = new Map([
    ["A", "A-a4"],
    ["B", "B-b1"],
    ["C", "C-c1"],
  ]);
  const seats: SeatsUsed = new Map([["A-a3", 1]]);

  it("alternatives: safe first, full flagged, current option excluded", () => {
    const plan = resolveClash("A-a1", alloc, cat, seats);
    expect(plan.alternatives.map((x) => [x.optionId, x.safe, x.full])).toEqual([
      ["A-a3", true, true],
      ["A-a2", false, false],
    ]);
    expect(plan.alternatives.find((x) => x.optionId === "A-a4")).toBeUndefined();
    expect(plan.alternatives.find((x) => x.optionId === "A-a1")).toBeUndefined();
    const a2 = plan.alternatives.find((x) => x.optionId === "A-a2")!;
    expect(a2.newClashes[0].optionB).toBe("C-c1");
  });

  it("blocker moves: moving B to a slot that clashes with A or C is unsafe", () => {
    const plan = resolveClash("A-a1", alloc, cat, seats);
    expect(plan.blockerMoves).toHaveLength(1);
    const by = new Map(plan.blockerMoves[0].candidates.map((x) => [x.optionId, x]));
    expect(by.get("B-b3")!.safe).toBe(true);
    expect(by.get("B-b2")!.safe).toBe(false);
    expect(by.get("B-b2")!.newClashes.map((c) => c.optionB)).toEqual(["C-c1"]);
    expect(by.get("B-b4")!.safe).toBe(false);
    expect(by.get("B-b4")!.newClashes.map((c) => c.optionB)).toEqual(["A-a1"]);
    expect(plan.blockerMoves[0].candidates[0].optionId).toBe("B-b3");
  });

  it("A's replaced slot is removed from the plan (A vs old option of its own group)", () => {
    // B-b? candidate overlapping the currently held A option (a4, Thu 9-10) is fine since A moves away
    const cat2 = makeCatalog([
      { id: "A", options: [one("A-1", 0, "09:00", "10:00"), one("A-2", 3, "09:00", "10:00")] },
      { id: "B", options: [one("B-1", 0, "09:30", "10:30"), one("B-2", 3, "09:00", "10:00")] },
    ]);
    const plan = resolveClash("A-1", new Map([["A", "A-2"], ["B", "B-1"]]), cat2, new Map());
    expect(plan.blockerMoves[0].candidates).toMatchObject([{ optionId: "B-2", safe: true }]);
  });

  it("directly selectable option has no clashes or blocker moves", () => {
    const plan = resolveClash("A-a4", new Map([["B", "B-b3"]]), cat, new Map());
    expect(plan.clashes).toEqual([]);
    expect(plan.blockerMoves).toEqual([]);
  });

  it("multiple blockers give one plan each; own seat never counts against blocker", () => {
    const cat3 = makeCatalog([
      { id: "A", options: [one("A-1", 0, "09:00", "12:00")] },
      { id: "B", options: [one("B-1", 0, "09:00", "10:00", "1-12", 1), one("B-2", 1, "09:00", "10:00")] },
      { id: "C", options: [one("C-1", 0, "11:00", "12:00"), one("C-2", 1, "09:30", "10:30")] },
    ]);
    const plan = resolveClash("A-1", new Map([["B", "B-1"], ["C", "C-1"]]), cat3, new Map([["B-1", 1]]));
    expect(plan.blockerMoves.map((b) => b.groupId).sort()).toEqual(["B", "C"]);
    expect(plan.clashes).toHaveLength(2);
  });

  it("throws on unknown option", () => {
    expect(() => resolveClash("nope", new Map(), cat, new Map())).toThrow();
  });
});
