import { describe, expect, inject, it } from "vitest";
import { readFileSync } from "node:fs";

// Contract: a fresh app boot seeds itself (src/middleware.ts); global-setup does not seed. Read-only: other spec
// files mutate some options in parallel (and restore them), so this asserts the seeded groups, not every option.
const baseUrl = inject("baseUrl");
const seed = JSON.parse(readFileSync("seed/sem2-2026.json", "utf8")) as {
  allocations: { group: string; option: string }[];
  courses: { code: string }[];
};

describe("boot seeding", () => {
  it("/api/state.json shows the 10 seeded groups with the starting allocation", async () => {
    const res = await fetch(new URL("/api/state.json", baseUrl), { headers: { "cache-control": "no-cache" } });
    expect(res.status).toBe(200);
    const s = (await res.json()) as { allocation: Record<string, string>; groups: { groupId: string }[] };
    expect(s.groups).toHaveLength(10);
    expect(Object.keys(s.allocation).sort()).toEqual(seed.allocations.map((a) => a.group).sort());
    // groups no other spec file touches must still be at their seeded option
    for (const g of ["comp3900-leca", "comp3900-tuta", "comp4020-leca", "comp4020-tuta"]) {
      const want = seed.allocations.find((a) => a.group === g)!.option;
      expect(s.allocation[g]).toMatch(new RegExp(`${want}$`));
    }
  });

  it("/timetable/ lists all four courses", async () => {
    const res = await fetch(new URL("/timetable/", baseUrl));
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const c of seed.courses) expect(html).toContain(c.code);
    expect(seed.courses).toHaveLength(4);
  });
});
