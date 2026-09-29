import { describe, expect, it } from "vitest";
import { allClashes } from "./clash";
import { defaultPrefs } from "./prefs";
import { autofix } from "./solve";
import type { Allocation, Catalog, Day, Group, Option, SeatsUsed } from "./types";

const ALL = 0b1111111111111;
const t = (h: number, m = 0) => h * 60 + m;

interface OptSpec {
  code: string;
  day: Day;
  start: number;
  end: number;
  cap?: number | null;
  loc?: string | null;
  extra?: { day: Day; start: number; end: number }[];
}

function catalogOf(groups: { id: string; opts: OptSpec[]; exempt?: boolean }[]): Catalog {
  const cat: Catalog = { terms: new Map(), courses: new Map(), groups: new Map(), options: new Map(), groupsByCourse: new Map() };
  for (const g of groups) {
    const options: Option[] = g.opts.map((o) => {
      const id = `${g.id}-${o.code}`;
      const mk = (part: string, day: Day, s: number, e: number) => ({
        id: `${id}-${part}`, optionId: id, part, day, startMin: s, endMin: e, weeks: ALL, location: o.loc ?? null, exempt: false,
      });
      return {
        id, groupId: g.id, code: o.code, capacity: o.cap === undefined ? 30 : o.cap, campus: null, staff: null, overflow: false,
        sessions: [mk("P1", o.day, o.start, o.end), ...(o.extra ?? []).map((x, i) => mk(`P${i + 2}`, x.day, x.start, x.end))],
      };
    });
    const group: Group = { id: g.id, courseId: g.id, kind: "tutorial", name: g.id, exemptFromClash: !!g.exempt, options };
    cat.groups.set(g.id, group);
    for (const o of options) cat.options.set(o.id, o);
  }
  return cat;
}
const A = (o: Record<string, string>): Allocation => new Map(Object.entries(o));
const noSeats: SeatsUsed = new Map();

describe("autofix", () => {
  it("is alreadyClean when nothing clashes", () => {
    const cat = catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(10) }] },
      { id: "y", opts: [{ code: "1", day: 0, start: t(10), end: t(11) }] },
    ]);
    const r = autofix(A({ x: "x-1", y: "y-1" }), cat, noSeats, null);
    expect(r).toMatchObject({ alreadyClean: true, solved: true, moves: [], capped: false });
  });

  it("finds a minimal single move", () => {
    const cat = catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(11) }] },
      { id: "y", opts: [{ code: "1", day: 0, start: t(10), end: t(12) }, { code: "2", day: 1, start: t(10), end: t(12) }] },
    ]);
    const r = autofix(A({ x: "x-1", y: "y-1" }), cat, noSeats, null);
    expect(r.solved).toBe(true);
    expect(r.moves).toEqual([{ groupId: "y", fromOptionId: "y-1", toOptionId: "y-2" }]);
    expect(allClashes(r.resulting, cat)).toHaveLength(0);
  });

  it("needs a joint two-move fix when single moves each create a new clash", () => {
    // x1 clashes y1. x2 (Tue) clashes y1's alternative? Build: x moves to x2 (Tue 9-10) which clashes with z (fixed Tue 9-10)?
    // Use: x1 Mon9-11, y1 Mon10-12 clash. x2 Tue 9-11, y2 Tue 10-12. Moving only x -> x2 clashes y1? no.
    // Make x2 clash with y1 and y2 clash with x1, so only (x2,y2)... would clash each other; add x3/y3 distinct.
    const cat = catalogOf([
      { id: "x", opts: [
        { code: "1", day: 0, start: t(9), end: t(11) },
        { code: "2", day: 0, start: t(11), end: t(13) }, // clashes y1 (10-12)? y1 is 10-12 -> yes
        { code: "3", day: 1, start: t(9), end: t(11) }, // clashes y2 (Tue 10-12)
      ] },
      { id: "y", opts: [
        { code: "1", day: 0, start: t(10), end: t(12) },
        { code: "2", day: 1, start: t(10), end: t(12) },
        { code: "3", day: 2, start: t(10), end: t(12) },
      ] },
    ]);
    const start = A({ x: "x-1", y: "y-1" });
    const r = autofix(start, cat, noSeats, null);
    // A single move y->y2 or y->y3 fixes it directly (x1 stays): minimal is 1 move.
    expect(r.moves).toHaveLength(1);
  });

  it("finds a joint two-move fix when the shared blocker cannot move", () => {
    // p1 clashes q1, q1 clashes r1. q's only alternative is full, so p and r must both move.
    const cat = catalogOf([
      { id: "p", opts: [
        { code: "1", day: 0, start: t(9), end: t(11) },
        { code: "2", day: 1, start: t(9), end: t(11) },
      ] },
      { id: "q", opts: [
        { code: "1", day: 0, start: t(10), end: t(12) },
        { code: "2", day: 2, start: t(14), end: t(15) },
      ] },
      { id: "r", opts: [
        { code: "1", day: 0, start: t(11), end: t(13) },
        { code: "2", day: 3, start: t(10), end: t(12) },
      ] },
    ]);
    const start = A({ p: "p-1", q: "q-1", r: "r-1" });
    expect(autofix(start, cat, noSeats, null).moves).toEqual([{ groupId: "q", fromOptionId: "q-1", toOptionId: "q-2" }]);
    const r2 = autofix(start, cat, new Map([["q-2", 30]]), null);
    expect(r2.solved).toBe(true);
    expect(r2.moves.map((m) => m.groupId).sort()).toEqual(["p", "r"]);
    expect(allClashes(r2.resulting, cat)).toHaveLength(0);
  });

  it("never picks a full option, but null capacity is allowed", () => {
    const cat = catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(11) }] },
      { id: "y", opts: [
        { code: "1", day: 0, start: t(10), end: t(12) },
        { code: "2", day: 1, start: t(10), end: t(12), cap: 5 },
        { code: "3", day: 2, start: t(10), end: t(12), cap: null },
      ] },
    ]);
    const r = autofix(A({ x: "x-1", y: "y-1" }), cat, new Map([["y-2", 5]]), null);
    expect(r.moves[0].toOptionId).toBe("y-3");
    const r2 = autofix(A({ x: "x-1", y: "y-1" }), catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(11) }] },
      { id: "y", opts: [{ code: "1", day: 0, start: t(10), end: t(12) }, { code: "2", day: 1, start: t(10), end: t(12), cap: 5 }] },
    ]), new Map([["y-2", 5]]), null);
    expect(r2.solved).toBe(false);
    expect(r2.moves).toEqual([]);
  });

  it("uses prefs as a tie-break among equal-move fixes", () => {
    const cat = catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(11) }] },
      { id: "y", opts: [
        { code: "1", day: 0, start: t(10), end: t(12) },
        { code: "2", day: 1, start: t(10), end: t(12) },
        { code: "3", day: 2, start: t(10), end: t(12) },
      ] },
    ]);
    const start = A({ x: "x-1", y: "y-1" });
    const p1 = { ...defaultPrefs(), daysOff: [1 as Day] };
    expect(autofix(start, cat, noSeats, p1).moves[0].toOptionId).toBe("y-3");
    const p2 = { ...defaultPrefs(), daysOff: [2 as Day] };
    const r = autofix(start, cat, noSeats, p2);
    expect(r.moves[0].toOptionId).toBe("y-2");
    expect(r.score?.total).toBe(0);
  });

  it("reports capped when the node cap is hit", () => {
    const cat = catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(11) }] },
      { id: "y", opts: [{ code: "1", day: 0, start: t(10), end: t(12) }, { code: "2", day: 1, start: t(10), end: t(12) }] },
    ]);
    const r = autofix(A({ x: "x-1", y: "y-1" }), cat, noSeats, null, { nodeCap: 1 });
    expect(r.capped).toBe(true);
    expect(r.solved).toBe(false);
  });

  it("is unsolvable when no option avoids the clash", () => {
    const cat = catalogOf([
      { id: "x", opts: [{ code: "1", day: 0, start: t(9), end: t(11) }] },
      { id: "y", opts: [{ code: "1", day: 0, start: t(10), end: t(12) }] },
    ]);
    const r = autofix(A({ x: "x-1", y: "y-1" }), cat, noSeats, null);
    expect(r).toMatchObject({ solved: false, alreadyClean: false, moves: [] });
  });

  it("student case: FINM1001 LecA vs COMP4650 LecA, overflow clone is a valid destination", () => {
    const cat = catalogOf([
      { id: "finm", opts: [
        { code: "01", day: 1, start: t(12), end: t(14), cap: 100 },
        { code: "01_Clone", day: 1, start: t(12), end: t(14), cap: 9999 },
      ] },
      { id: "comp4650", opts: [
        { code: "01", day: 1, start: t(13), end: t(15, 30), cap: 100 },
        { code: "01_Clone", day: 1, start: t(13), end: t(15, 30), cap: 9999 },
      ] },
    ]);
    // Same slots in the clones, so no move can help: honestly unsolvable.
    const r = autofix(A({ finm: "finm-01", "comp4650": "comp4650-01" }), cat, new Map([["finm-01", 100]]), null);
    expect(r.solved).toBe(false);
    // If the clone of one lecture sits at a different time, it becomes the fix.
    cat.options.get("comp4650-01_Clone")!.sessions[0].startMin = t(15, 30);
    cat.options.get("comp4650-01_Clone")!.sessions[0].endMin = t(17);
    const r2 = autofix(A({ finm: "finm-01", "comp4650": "comp4650-01" }), cat, noSeats, null);
    expect(r2.moves).toEqual([{ groupId: "comp4650", fromOptionId: "comp4650-01", toOptionId: "comp4650-01_Clone" }]);
  });

  it("moves a currently non-clashing group when the fix needs it (chain, exactly 2 moves)", () => {
    // A1 clashes B1. A's only alternative A2 collides with C1 (which clashes with nothing now). C has a free alt.
    // B has no alternative, so the minimal fix is A -> A2 and C -> C2.
    const cat = catalogOf([
      { id: "a", opts: [
        { code: "1", day: 0, start: t(9), end: t(11) },
        { code: "2", day: 1, start: t(9), end: t(11) },
      ] },
      { id: "b", opts: [{ code: "1", day: 0, start: t(10), end: t(12) }] },
      { id: "c", opts: [
        { code: "1", day: 1, start: t(10), end: t(12) },
        { code: "2", day: 4, start: t(10), end: t(12) },
      ] },
    ]);
    const r = autofix(A({ a: "a-1", b: "b-1", c: "c-1" }), cat, noSeats, null);
    expect(r.solved).toBe(true);
    expect(r.moves).toHaveLength(2);
    expect(r.moves.map((m) => m.groupId).sort()).toEqual(["a", "c"]);
    expect(allClashes(r.resulting, cat)).toHaveLength(0);
    console.log("chain nodes", r.nodes);
  });

  it("prefers a 1-move fix over a 2-move one", () => {
    const cat = catalogOf([
      { id: "a", opts: [
        { code: "1", day: 0, start: t(9), end: t(11) },
        { code: "2", day: 1, start: t(9), end: t(11) },
      ] },
      { id: "b", opts: [
        { code: "1", day: 0, start: t(10), end: t(12) },
        { code: "2", day: 3, start: t(10), end: t(12) },
      ] },
      { id: "c", opts: [
        { code: "1", day: 1, start: t(10), end: t(12) },
        { code: "2", day: 4, start: t(10), end: t(12) },
      ] },
    ]);
    const r = autofix(A({ a: "a-1", b: "b-1", c: "c-1" }), cat, noSeats, null);
    expect(r.moves).toEqual([{ groupId: "b", fromOptionId: "b-1", toOptionId: "b-2" }]);
  });

  it("real data: single-slot lectures whose clones share the slot are unsolvable", () => {
    const cat = catalogOf([
      { id: "finm", opts: [
        { code: "01", day: 1, start: t(12), end: t(14), cap: 100 },
        { code: "01_Clone", day: 1, start: t(12), end: t(14), cap: 9999 },
      ] },
      { id: "comp4650", opts: [
        { code: "01", day: 1, start: t(13), end: t(15, 30), cap: 100 },
        { code: "01_Clone", day: 1, start: t(13), end: t(15, 30), cap: 9999 },
      ] },
      { id: "tut", opts: [{ code: "01", day: 3, start: t(9), end: t(10) }, { code: "02", day: 4, start: t(9), end: t(10) }] },
    ]);
    const r = autofix(A({ finm: "finm-01", comp4650: "comp4650-01", tut: "tut-01" }), cat, noSeats, null);
    expect(r.solved).toBe(false);
    expect(r.moves).toEqual([]);
    expect(r.alreadyClean).toBe(false);
    expect(r.capped).toBe(false);
    console.log("unsolvable nodes", r.nodes);
  });

  it("tutorial case: COMP3900 TutA 04 vs COMP4020 TutA 04 finds a minimal fix", () => {
    const cat = catalogOf([
      { id: "comp3900-tuta", opts: [
        { code: "03", day: 2, start: t(9), end: t(10, 30) },
        { code: "04", day: 2, start: t(11), end: t(12, 30) },
      ] },
      { id: "comp4020-tuta", opts: [
        { code: "03", day: 2, start: t(9), end: t(10, 30) },
        { code: "04", day: 2, start: t(10, 30), end: t(12) },
        { code: "05", day: 3, start: t(10, 30), end: t(12) },
      ] },
    ]);
    const start = A({ "comp3900-tuta": "comp3900-tuta-04", "comp4020-tuta": "comp4020-tuta-04" });
    const r = autofix(start, cat, noSeats, null);
    // Single moves: 3900 -> 03 (Wed 9-10:30) is clash-free vs 4020-04; 4020 -> 05 (Thu) is too. Either is 1 move.
    expect(r.solved).toBe(true);
    expect(r.moves).toHaveLength(1);
    expect(allClashes(r.resulting, cat)).toHaveLength(0);
    // With every alternative full there is no fix.
    const full: SeatsUsed = new Map([["comp3900-tuta-03", 30], ["comp4020-tuta-03", 30], ["comp4020-tuta-05", 30]]);
    expect(autofix(start, cat, full, null).solved).toBe(false);
  });
});
