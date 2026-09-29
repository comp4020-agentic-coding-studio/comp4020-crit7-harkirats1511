import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

type Row = Record<string, any>;
let client: import("better-sqlite3").Database;
let load: typeof import("./load.ts");
const all = (sql: string, ...p: unknown[]) => client.prepare(sql).all(...p) as Row[];
const one = (sql: string, ...p: unknown[]) => client.prepare(sql).get(...p) as Row;
const mask = (...w: number[]) => w.reduce((m, x) => m | (1 << (x - 1)), 0);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

let first: boolean;
beforeAll(async () => {
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "seed-test-")), "t.db");
  client = (await import("../db.ts")).client;
  load = await import("./load.ts");
  first = load.seedIfEmpty({ strict: true, log: () => {} });
});

describe("seedIfEmpty on a fresh database", () => {
  it("inserts, then is a no-op", () => {
    expect(first).toBe(true);
    const before = one("select count(*) n from sessions").n;
    expect(load.seedIfEmpty({ log: () => {} })).toBe(false);
    expect(one("select count(*) n from sessions").n).toBe(before);
  });

  it("counts", () => {
    expect(one("select count(*) n from terms").n).toBe(1);
    expect(one("select count(*) n from courses").n).toBe(4);
    expect(one("select count(*) n from course_aliases").n).toBe(3);
    expect(one("select count(*) n from activity_groups").n).toBe(10);
    expect(one("select count(*) n from options").n).toBe(37);
    expect(one("select count(*) n from allocations").n).toBe(10);
    expect(one("select count(*) n from students").n).toBe(1);
    expect(one("select * from terms")).toMatchObject({ id: "2026s2", start_date: "2026-07-27", teaching_weeks: 12, break_after_week: 6 });
  });

  it("student is a name only", () => {
    expect(all("select * from students")).toEqual([expect.objectContaining({ id: "me", name: "Harkirat Singh Sandhu" })]);
    expect(Object.keys(one("select * from students")).sort()).toEqual(["created_at", "id", "name"]);
  });

  it("MyTT ids", () => {
    const ids = all("select id from options").map((r) => r.id);
    for (const id of ["comp4020-tuta-04", "comp3900-leca-01_clone", "comp4650-coma-03", "comp4650-drob-01", "finm1001-wora-01"]) {
      expect(ids).toContain(id);
    }
    expect(one("select code, overflow, capacity from options where id = 'comp3900-leca-01_clone'")).toEqual({ code: "01_Clone", overflow: 1, capacity: 992 });
    expect(all("select alias from (select code as alias from course_aliases where course_id='comp4650')")).toEqual([{ alias: "COMP6490" }]);
  });

  it("starting allocations", () => {
    const got = Object.fromEntries(all("select group_id g, option_id o from allocations where student_id='me'").map((r) => [r.g, r.o]));
    expect(got).toEqual({
      "comp3900-leca": "comp3900-leca-01",
      "comp3900-tuta": "comp3900-tuta-05",
      "comp4020-leca": "comp4020-leca-01",
      "comp4020-tuta": "comp4020-tuta-04",
      "comp4650-leca": "comp4650-leca-01",
      "comp4650-coma": "comp4650-coma-03",
      "comp4650-drob": "comp4650-drob-01",
      "finm1001-leca": "finm1001-leca-01",
      "finm1001-tuta": "finm1001-tuta-03",
      "finm1001-wora": "finm1001-wora-01",
    });
  });

  it("capacity = Free, +1 for the allocated option", () => {
    const cap = (id: string) => one("select capacity c from options where id = ?", id).c;
    expect(cap("comp3900-tuta-05")).toBe(1);
    expect(cap("comp3900-tuta-01")).toBe(7);
    expect(cap("comp4020-tuta-04")).toBe(2);
    expect(cap("comp4650-drob-01")).toBe(1);
    expect(cap("finm1001-wora-01")).toBe(39);
    expect(cap("finm1001-tuta-03")).toBe(1);
  });

  it("COMP3900 TutA 05 sessions", () => {
    const s = all("select * from sessions where option_id='comp3900-tuta-05' order by part");
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ part: "P1", day: 2, start_min: 840, end_min: 930, exempt: 0, location: "Rm 2.03_Fulton Muir Bldg 95", weeks: mask(...range(2, 12)) });
    expect(s[1]).toMatchObject({ part: "P2", day: 2, start_min: 930, end_min: 960, exempt: 1, weeks: mask(...range(2, 12)) });
  });

  it("weeks: Monday lecture skips Labour Day, COMP4020 TutA 01 P2 is week 9 only, COMP4650 alternate weeks", () => {
    expect(one("select weeks w from sessions where option_id='comp3900-leca-01'").w).toBe(mask(...range(1, 8), ...range(10, 12)));
    expect(one("select weeks w from sessions where id='comp4020-tuta-01-p2'").w).toBe(mask(9));
    expect(one("select weeks w from sessions where id='comp4020-tuta-01-p1'").w).toBe(mask(...range(2, 8), ...range(10, 12)));
    for (const o of ["01", "03", "05"]) {
      expect(one(`select weeks w from sessions where id='comp4650-coma-${o}-p1'`).w).toBe(mask(2, 4, 6, 7, 8, 10));
    }
  });

  it("the 01_Clone options are overflow with no location", () => {
    const clones = all("select o.id, o.overflow, s.location from options o join sessions s on s.option_id=o.id where o.code='01_Clone'");
    expect(clones).toHaveLength(3);
    for (const c of clones) expect(c).toMatchObject({ overflow: 1, location: null });
  });

  it("raw staff u-numbers are stored as unknown; no u-number or email anywhere", () => {
    expect(one("select staff from options where id='finm1001-tuta-02'").staff).toBeNull();
    expect(one("select staff from options where id='finm1001-tuta-01'").staff).toBe("Martha Dingle");
    const dump = JSON.stringify([
      all("select * from options"), all("select * from students"), all("select * from courses"),
    ]);
    expect(dump).not.toMatch(/u\d{7}/i);
    expect(dump).not.toMatch(/@/);
  });

  it("DroB 01 is an exempt drop-in group and does not clash with COMP3900 TutA 05", () => {
    expect(one("select kind, exempt_from_clash e from activity_groups where id='comp4650-drob'")).toEqual({ kind: "dropin", e: 1 });
    const drob = one("select * from sessions where option_id='comp4650-drob-01'");
    expect(drob).toMatchObject({ day: 2, start_min: 900, end_min: 1020, weeks: mask(...range(3, 12)) });
    // Real 30-minute overlap with the tutorial part, in weeks 3-12: still not a clash because the group is exempt.
    const tut = one("select * from sessions where id='comp3900-tuta-05-p1'");
    expect(Math.min(drob.end_min, tut.end_min) - Math.max(drob.start_min, tut.start_min)).toBe(30);
    expect(drob.weeks & tut.weeks).not.toBe(0);
  });
});

describe("reseed (upsert)", () => {
  it("is idempotent and keeps the student's own allocation changes", () => {
    client.prepare("update allocations set option_id='comp4020-tuta-03' where student_id='me' and group_id='comp4020-tuta'").run();
    const counts = () => [one("select count(*) n from options").n, one("select count(*) n from sessions").n, one("select count(*) n from allocations").n];
    const before = counts();
    const stats = load.reseed({ log: () => {} });
    expect(counts()).toEqual(before);
    expect(stats.allocations).toBe(0);
    expect(one("select option_id o from allocations where student_id='me' and group_id='comp4020-tuta'").o).toBe("comp4020-tuta-03");
  });
  it("--reset restores the starting allocations", () => {
    load.reseed({ reset: true, log: () => {} });
    expect(one("select option_id o from allocations where student_id='me' and group_id='comp4020-tuta'").o).toBe("comp4020-tuta-04");
    expect(one("select count(*) n from allocations").n).toBe(10);
  });
});

describe("draft mode with TODO groups and placeholders", () => {
  it("skips TODO groups, inserts enrolled placeholders", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const dir = mkdtempSync(join(tmpdir(), "seed-todo-"));
    const p = join(dir, "s.json");
    writeFileSync(p, JSON.stringify({
      term: { id: "x1", name: "X", startDate: "2026-07-27", teachingWeeks: 12, breakAfterWeek: 6 },
      courses: [{ code: "ZZZZ1000", title: "Z", groups: [
        { id: "zzzz1000-leca", kind: "lecture", name: "Lec A", options: [{ code: "01", capacity: 5, enrolled: 3, sessions: [{ day: "Mon", start: "09:00", end: "10:00", weeks: "1-6" }] }] },
        { id: "zzzz1000-wora", kind: "workshop", name: "Wor A", options: "TODO" },
      ] }],
    }));
    const logs: string[] = [];
    const stats = load.reseed({ path: p, log: (m) => logs.push(m) });
    expect(stats.skipped).toEqual(["zzzz1000-wora"]);
    expect(stats.placeholders).toBe(3);
    expect(logs.join()).toMatch(/zzzz1000-wora/);
    expect(one("select count(*) n from allocations where option_id='zzzz1000-leca-01'").n).toBe(3);
    expect(() => load.reseed({ path: p, strict: true, log: () => {} })).toThrow(/options: TODO/);
  });
});
