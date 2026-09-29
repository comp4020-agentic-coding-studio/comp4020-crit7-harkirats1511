import { describe, expect, it } from "vitest";
import { assignLanes, blockDetail, dayTabs, daysBeyond, fitAxis, fmtTime, freeLaneRun, maxLanes, minBoardPx, pickDefaultDay } from "./grid-layout";

const s = (startMin: number, endMin: number) => ({ startMin, endMin });

describe("assignLanes", () => {
  it("empty and single", () => {
    expect(assignLanes([])).toEqual([]);
    expect(assignLanes([s(0, 60)])).toEqual([{ lane: 0, clusterLanes: 1 }]);
  });
  it("identical intervals each get a lane", () => {
    const r = assignLanes([s(60, 120), s(60, 120), s(60, 120)]);
    expect(r.map((x) => x.lane).sort()).toEqual([0, 1, 2]);
    expect(r.every((x) => x.clusterLanes === 3)).toBe(true);
  });
  it("nested intervals", () => {
    const r = assignLanes([s(0, 300), s(60, 120), s(150, 200)]);
    expect(r[0].lane).toBe(0);
    expect(r[1].lane).toBe(1);
    expect(r[2].lane).toBe(1); // reuses lane freed by the inner block
    expect(maxLanes(r)).toBe(2);
  });
  it("chained intervals reuse lanes", () => {
    const r = assignLanes([s(0, 100), s(50, 150), s(120, 220)]);
    expect(r.map((x) => x.lane)).toEqual([0, 1, 0]);
    expect(r.every((x) => x.clusterLanes === 2)).toBe(true);
  });
  it("touching intervals do not overlap and clusters are independent", () => {
    const r = assignLanes([s(0, 60), s(60, 120), s(300, 400), s(300, 400)]);
    expect(r[0]).toEqual({ lane: 0, clusterLanes: 1 });
    expect(r[1]).toEqual({ lane: 0, clusterLanes: 1 });
    expect(r[2].clusterLanes).toBe(2);
  });
  it("no two blocks in the same lane overlap (property)", () => {
    const spans = Array.from({ length: 40 }, (_, i) => s((i * 37) % 400, ((i * 37) % 400) + 20 + ((i * 11) % 90)));
    const r = assignLanes(spans);
    for (let i = 0; i < spans.length; i++)
      for (let j = i + 1; j < spans.length; j++)
        if (r[i].lane === r[j].lane)
          expect(spans[i].endMin <= spans[j].startMin || spans[j].endMin <= spans[i].startMin).toBe(true);
  });
});

describe("fitAxis / fmtTime", () => {
  it("rounds to hours and pads", () => {
    expect(fitAxis([s(9 * 60 + 30, 11 * 60 + 15)])).toEqual({ startHour: 8, endHour: 13 });
  });
  it("clamps and defaults", () => {
    expect(fitAxis([s(30, 60)])).toEqual({ startHour: 0, endHour: 2 });
    expect(fitAxis([])).toEqual({ startHour: 8, endHour: 18 });
  });
  it("formats 24h", () => {
    expect(fmtTime(840)).toBe("14:00");
    expect(fmtTime(9 * 60 + 5)).toBe("09:05");
  });
});

describe("day tabs and switcher", () => {
  const blocks = [
    { day: 1, kind: "option" as const },
    { day: 1, kind: "collides" as const },
    { day: 2, kind: "ghost" as const },
    { day: 3, kind: "yours" as const },
  ];
  it("counts blocks and flags collisions, ignoring ghosts", () => {
    expect(dayTabs(blocks, [0, 1, 2, 3, 4])).toEqual([
      { day: 0, count: 0, collides: false },
      { day: 1, count: 2, collides: true },
      { day: 2, count: 0, collides: false },
      { day: 3, count: 1, collides: false },
      { day: 4, count: 0, collides: false },
    ]);
    expect(dayTabs(blocks, [2], true)[0].count).toBe(1);
  });
  it("defaults to first candidate/collision day, honours a valid request", () => {
    expect(pickDefaultDay(blocks, [0, 1, 2, 3, 4], null)).toBe(1);
    expect(pickDefaultDay(blocks, [0, 1, 2, 3, 4], 3)).toBe(3);
    expect(pickDefaultDay(blocks, [0, 1, 2], 6)).toBe(1);
    expect(pickDefaultDay([{ day: 4, kind: "yours" }], [0, 4], null)).toBe(4);
    expect(pickDefaultDay([], [0, 1], null)).toBe(0);
  });
});

describe("board width", () => {
  it("sums lanes at the minimum lane width", () => {
    expect(minBoardPx([1, 1, 1, 1, 1])).toBe(56 + 5 * 120);
    expect(minBoardPx([0, 2])).toBe(56 + 3 * 120);
  });
  it("names days that fall off the edge", () => {
    expect(daysBeyond([1, 1, 1, 1, 1], 1200)).toEqual([]);
    expect(daysBeyond([2, 2, 2, 2, 2], 1000)).toEqual([3, 4]);
  });
  it("blockDetail is full only when tall enough", () => {
    expect(blockDetail(84, 0)).toBe("compact");
    expect(blockDetail(200, 0)).toBe("full");
    expect(blockDetail(170, 2)).toBe("compact");
  });
});

describe("freeLaneRun", () => {
  const laned = [s(0, 100), s(0, 100), s(200, 300)];
  const lanes = [0, 1, 0];
  it("uses the free lanes", () => {
    expect(freeLaneRun(s(210, 250), laned, lanes, 3)).toEqual({ from: 1, count: 2 });
    expect(freeLaneRun(s(120, 180), laned, lanes, 3)).toEqual({ from: 0, count: 3 });
  });
  it("falls back to full width when all lanes are busy", () => {
    expect(freeLaneRun(s(10, 50), laned, lanes, 2)).toEqual({ from: 0, count: 2 });
  });
});
