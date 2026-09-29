import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Allocation, Catalog, SeatsUsed, Term } from "./engine/types";
import * as D from "./daybook";

// The Daybook view model on the REAL seed (my Sem 2 2026 MyTimetable data), because the pages it feeds are judged on
// exactly this data: the unfixable Tuesday lecture clash, COMP3900's other tutorial times, the full COMP4020 tutorials.
let catalog: Catalog;
let real: Allocation;
let seats: SeatsUsed;
let term: Term;

beforeAll(async () => {
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "daybook-")), "t.db");
  const load = await import("./seed/load.ts");
  load.seedIfEmpty({ log: () => {} });
  const svc = await import("./services/alloc.ts");
  catalog = svc.loadCatalog();
  real = svc.loadAllocation("me");
  seats = svc.seatsUsed();
  term = [...catalog.terms.values()][0];
});

const at = (iso: string) => D.nowInCanberra(new Date(), iso);

describe("words", () => {
  it("uses 12-hour times with the suffix once", () => {
    expect(D.time12(9 * 60)).toBe("9am");
    expect(D.time12(12 * 60 + 30)).toBe("12:30pm");
    expect(D.range12(14 * 60, 15 * 60 + 30)).toBe("2–3:30pm");
    expect(D.range12(11 * 60, 12 * 60 + 30)).toBe("11am–12:30pm");
    expect(D.range12(9 * 60, 10 * 60 + 30)).toBe("9–10:30am");
  });
  it("gets plurals right", () => {
    expect(D.seatsText(1)).toBe("1 seat left");
    expect(D.seatsText(7)).toBe("7 seats left");
    expect(D.plural(1, "clash", "clashes")).toBe("1 clash");
  });
  it("names rooms the way students do", () => {
    expect(D.roomName("Rm 2.03_Fulton Muir Bldg 95")).toBe("Fulton Muir 2.03");
    expect(D.roomName("Lec Theatre_Copland Bldg 25")).toBe("Copland Lecture Theatre");
    expect(D.roomName("Lecture Theatre 1.28A_RN Robertson Bldg 46")).toBe("Robertson Lecture Theatre 1.28A");
    expect(D.roomName("Cinema Rm 1.02_Lowitja O'Donoghue Cultural Centre Bldg 153")).toBe("Lowitja O'Donoghue Cinema 1.02");
    expect(D.roomName(null)).toBeNull();
  });
  it("words teaching weeks without the break as a gap", () => {
    expect(D.weeksWords(0b111111111110)).toBe("weeks 2–12");
    expect(D.weeksWords(1 << 8)).toBe("week 9");
    expect(D.weeksWords((1 << 1) | (1 << 3) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 9))).toBe("weeks 2, 4, 6–8 and 10");
  });
});

describe("which week", () => {
  it("a weekday in week 8 is today in week 8", () => {
    const w = D.weekView(term, at("2026-09-30T09:00"));
    expect(w.week).toBe(8);
    expect(w.today).toBe(2);
    expect(D.dateLabel(w.dates[0])).toBe("28 September");
  });
  it("the weekend looks ahead to next week", () => {
    const w = D.weekView(term, at("2026-10-03T09:00"));
    expect(w.week).toBe(9);
    expect(w.today).toBeNull();
  });
  it("the mid-semester break shows week 7 and says why", () => {
    const w = D.weekView(term, at("2026-09-10T09:00"));
    expect(w.week).toBe(7);
    expect(w.note).toBe("Mid-semester break");
  });
  it("before and after term clamp to the first and last week", () => {
    expect(D.weekView(term, at("2026-07-01T09:00")).week).toBe(1);
    expect(D.weekView(term, at("2026-12-01T09:00"))).toMatchObject({ week: 12, today: null, note: "Teaching has finished" });
  });
});

describe("week navigation", () => {
  it("parseWeek only accepts a whole teaching week", () => {
    expect(D.parseWeek("8", term)).toBe(8);
    expect(D.parseWeek("1", term)).toBe(1);
    expect(D.parseWeek("12", term)).toBe(12);
    expect(D.parseWeek("0", term)).toBeNull();
    expect(D.parseWeek("13", term)).toBeNull();
    expect(D.parseWeek("-1", term)).toBeNull();
    expect(D.parseWeek("8.5", term)).toBeNull();
    expect(D.parseWeek("abc", term)).toBeNull();
    expect(D.parseWeek("", term)).toBeNull();
    expect(D.parseWeek(null, term)).toBeNull();
  });

  it("clamps prev/next at the first and last teaching week", () => {
    expect(D.weekNav(term, 1, 8)).toMatchObject({ prev: null, next: 2 });
    expect(D.weekNav(term, 12, 8)).toMatchObject({ prev: 11, next: null });
    expect(D.weekNav(term, 7, 8)).toMatchObject({ prev: 6, next: 8 });
  });

  it("marks isCurrent against the week being compared to", () => {
    expect(D.weekNav(term, 8, 8).isCurrent).toBe(true);
    expect(D.weekNav(term, 9, 8).isCurrent).toBe(false);
  });

  it("flags the week right after and right before the mid-semester break", () => {
    expect(D.weekNav(term, 6, 8)).toMatchObject({ breakBefore: false, breakAfter: true });
    expect(D.weekNav(term, 7, 8)).toMatchObject({ breakBefore: true, breakAfter: false });
    expect(D.weekNav(term, 8, 8)).toMatchObject({ breakBefore: false, breakAfter: false });
  });

  it("labels and dates match the real term's calendar", () => {
    expect(D.weekNav(term, 7, 8)).toMatchObject({ label: "Week 7", dates: "21 September to 25 September" });
    expect(D.weekNav(term, 8, 8)).toMatchObject({ label: "Week 8", dates: "28 September to 2 October" });
    expect(D.weekNav(term, 6, 8)).toMatchObject({ label: "Week 6", dates: "31 August to 4 September" });
  });
});

describe("my week on the real data", () => {
  it("week 8 has exactly one clash: the Tuesday lectures, 1–2pm, and nothing can fix it", () => {
    const ev = D.weekEvents(real, catalog, 8);
    const clashes = D.eventClashes(ev);
    expect(clashes).toHaveLength(1);
    const c = clashes[0];
    expect([c.a.course.code, c.b.course.code].sort()).toEqual(["COMP4650", "FINM1001"]);
    expect([c.day, c.from, c.to]).toEqual([1, 13 * 60, 14 * 60]);
    const p = D.weekProblem(ev, real, catalog, seats);
    expect(p?.fixGroupId).toBeNull();
  });
  it("the drop-in is optional and merges the tutorial's P2 into one block", () => {
    const wed = D.weekEvents(real, catalog, 8).filter((e) => e.day === 2);
    const tut = wed.find((e) => e.groupId === "comp3900-tuta")!;
    expect([tut.start, tut.end, tut.tailEnd]).toEqual([14 * 60, 15 * 60 + 30, 16 * 60]);
    expect(wed.find((e) => e.groupId === "comp4650-drob")?.optional).toBe(true);
  });
  it("labs only show in the weeks they run", () => {
    const has = (w: number) => D.weekEvents(real, catalog, w).some((e) => e.groupId === "comp4650-coma");
    expect(has(8)).toBe(true);
    expect(has(9)).toBe(false);
  });
});

describe("change a class", () => {
  it("judges COMP3900's other tutorial times with honest reasons and hides overflow clones", () => {
    const j = D.judgeGroup("comp3900-tuta", real, catalog, seats);
    const by = (code: string) => j.find((x) => x.option.code === code)!;
    expect(j.some((x) => x.option.overflow)).toBe(false);
    expect(by("05").held).toBe(true);
    expect(by("01")).toMatchObject({ legal: true, when: "Tue 9–10:30am", seatsLeft: 7 });
    expect(by("06")).toMatchObject({ legal: true, info: "Overlaps your optional COMP4650 drop-in" });
    expect(by("04")).toMatchObject({ legal: false, reason: "Overlaps your COMP4020 tutorial (which can’t move)" });
    expect(by("02")).toMatchObject({ legal: false, reason: "Full" });
    expect(D.stuckBlockers(j, real, catalog, seats)).toEqual([{ groupId: "comp4020-tuta", why: "every other time is full" }]);
  });
  it("a lecture with only an overflow copy runs once", () => {
    expect(D.mobility("finm1001-leca", real, catalog, seats)).toEqual({ movable: false, why: "it runs once" });
  });
});

describe("swap a time", () => {
  it("ranks no overlaps first, then most seats, at most three", () => {
    const j = D.judgeGroup("finm1001-tuta", real, catalog, seats);
    const cards = D.rankSwaps(j, D.weekEvents(real, catalog, 8), "finm1001-tuta");
    expect(cards.map((c) => c.j.when)).toEqual(["Thu 5–6pm", "Wed 5–6pm", "Wed 4–5pm"]);
    expect(cards[0].why.map((w) => w.text)).toContain("Still Thursday, so no new trip");
    expect(cards[0].why.map((w) => w.text)).toContain("Thursday starts at 11am instead of 9am");
    expect(cards[1].why.map((w) => w.text)).toContain("Last seat, so it could go before you swap");
    expect(cards[2].badge).toBe("Overlaps a drop-in");
  });
});
