import { describe, expect, it } from "vitest";
import { diffAlloc, effectiveAlloc } from "./draft";

describe("draft", () => {
  const real = new Map([
    ["g1", "o1"],
    ["g2", "o2"],
    ["g3", "o3"],
  ]);
  it("applies overlay without mutating inputs", () => {
    const overlay = new Map<string, string | null>([
      ["g1", "o9"],
      ["g2", null],
      ["g4", "o4"],
    ]);
    const eff = effectiveAlloc(real, overlay);
    expect([...eff]).toEqual([
      ["g1", "o9"],
      ["g3", "o3"],
      ["g4", "o4"],
    ]);
    expect(real.get("g1")).toBe("o1");
    expect(real.has("g2")).toBe(true);
    expect(overlay.size).toBe(3);
  });
  it("empty overlay is a copy", () => {
    const eff = effectiveAlloc(real, new Map());
    expect(eff).not.toBe(real);
    expect([...eff]).toEqual([...real]);
  });
  it("diffAlloc yields ordered moves", () => {
    const target = effectiveAlloc(
      real,
      new Map<string, string | null>([
        ["g4", "o4"],
        ["g2", null],
        ["g1", "o9"],
      ]),
    );
    expect(diffAlloc(real, target)).toEqual([
      { groupId: "g1", fromOptionId: "o1", toOptionId: "o9" },
      { groupId: "g2", fromOptionId: "o2", toOptionId: null },
      { groupId: "g4", fromOptionId: null, toOptionId: "o4" },
    ]);
    expect(diffAlloc(real, new Map(real))).toEqual([]);
  });
});
