import { describe, expect, it } from "vitest";
import { defaultPrefs, parsePrefs, scorePrefs } from "./prefs";
import type { Allocation, Catalog, Day, Option } from "./types";

const ALL = 0b1111111111111;
const t = (h: number, m = 0) => h * 60 + m;

function cat(specs: { id: string; day: Day; s: number; e: number; loc?: string | null; campus?: string | null; exempt?: boolean; weeks?: number }[]) {
  const c: Catalog = { terms: new Map(), courses: new Map(), groups: new Map(), options: new Map(), groupsByCourse: new Map() };
  const alloc: Allocation = new Map();
  for (const s of specs) {
    const o: Option = {
      id: s.id, groupId: s.id, code: "01", capacity: 10, campus: s.campus ?? null, staff: null, overflow: false,
      sessions: [{ id: `${s.id}-s`, optionId: s.id, part: "P1", day: s.day, startMin: s.s, endMin: s.e, weeks: s.weeks ?? ALL, location: s.loc ?? null, exempt: !!s.exempt }],
    };
    c.options.set(s.id, o);
    alloc.set(s.id, s.id);
  }
  return { c, alloc };
}

describe("parsePrefs", () => {
  it("returns defaults for junk", () => {
    expect(parsePrefs("{nope")).toEqual(defaultPrefs());
    expect(parsePrefs(null)).toEqual(defaultPrefs());
    expect(parsePrefs([1])).toEqual(defaultPrefs());
  });
  it("keeps good fields and ignores bad ones", () => {
    const p = parsePrefs(JSON.stringify({ daysOff: [0, 9, "x", 0, 4], earliestStartMin: 540, latestEndMin: "late", weights: { early: 5, gap: -1, walk: "x" } }));
    expect(p.daysOff).toEqual([0, 4]);
    expect(p.earliestStartMin).toBe(540);
    expect(p.latestEndMin).toBeNull();
    expect(p.weights.early).toBe(5);
    expect(p.weights.gap).toBe(defaultPrefs().weights.gap);
  });
});

describe("scorePrefs", () => {
  it("is 0 with neutral prefs", () => {
    const { c, alloc } = cat([{ id: "a", day: 0, s: t(8), e: t(9) }]);
    expect(scorePrefs(alloc, c, defaultPrefs()).total).toBe(0);
  });
  it("penalises a preferred day off, exempt sessions included", () => {
    const { c, alloc } = cat([{ id: "a", day: 0, s: t(9), e: t(10), exempt: true }]);
    const s = scorePrefs(alloc, c, { ...defaultPrefs(), daysOff: [0] });
    expect(s.penalties[0].kind).toBe("dayOff");
    expect(s.penalties[0].detail).toMatch(/Mon has 1 session/);
    expect(scorePrefs(alloc, c, { ...defaultPrefs(), daysOff: [0], weights: { ...defaultPrefs().weights, dayOff: 0 } }).total).toBe(0);
  });
  it("penalises early and late", () => {
    const { c, alloc } = cat([{ id: "a", day: 1, s: t(8), e: t(19) }]);
    const s = scorePrefs(alloc, c, { ...defaultPrefs(), earliestStartMin: t(9), latestEndMin: t(18) });
    expect(s.penalties.map((p) => p.kind).sort()).toEqual(["early", "late"]);
  });
  it("penalises long gaps only when sessions share a week", () => {
    const p = { ...defaultPrefs(), maxGapMin: 120 };
    const both = cat([{ id: "a", day: 2, s: t(9), e: t(10) }, { id: "b", day: 2, s: t(14), e: t(15) }]);
    expect(scorePrefs(both.alloc, both.c, p).penalties.map((x) => x.kind)).toEqual(["gap"]);
    const disjoint = cat([{ id: "a", day: 2, s: t(9), e: t(10), weeks: 0b1 }, { id: "b", day: 2, s: t(14), e: t(15), weeks: 0b10 }]);
    expect(scorePrefs(disjoint.alloc, disjoint.c, p).total).toBe(0);
  });
  it("penalises tight building changes, ignores unknown buildings", () => {
    const p = { ...defaultPrefs(), minWalkGapMin: 20 };
    const tight = cat([{ id: "a", day: 3, s: t(9), e: t(10), loc: "Hanna_145" }, { id: "b", day: 3, s: t(10, 5), e: t(11), loc: "Chem Bldg 34" }]);
    expect(scorePrefs(tight.alloc, tight.c, p).penalties.map((x) => x.kind)).toEqual(["walk"]);
    const unknown = cat([{ id: "a", day: 3, s: t(9), e: t(10), loc: "Hanna_145" }, { id: "b", day: 3, s: t(10, 5), e: t(11), loc: null }]);
    expect(scorePrefs(unknown.alloc, unknown.c, p).total).toBe(0);
    const campus = cat([{ id: "a", day: 3, s: t(9), e: t(10), campus: "Acton" }, { id: "b", day: 3, s: t(10), e: t(11), campus: "Online" }]);
    expect(scorePrefs(campus.alloc, campus.c, p).total).toBeGreaterThan(0);
    const roomy = cat([{ id: "a", day: 3, s: t(9), e: t(10), loc: "X_1" }, { id: "b", day: 3, s: t(10, 30), e: t(11), loc: "Y_2" }]);
    expect(scorePrefs(roomy.alloc, roomy.c, p).total).toBe(0);
  });
});
