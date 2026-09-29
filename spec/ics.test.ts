import { describe, expect, inject, it } from "vitest";

// Contract test against the RUNNING app (see spec/invariants.test.ts). Red until the services (E) and seed (D) land.
const baseUrl = inject("baseUrl");

describe("GET /api/timetable.ics", () => {
  it("serves a calendar with at least one event", async () => {
    const res = await fetch(new URL("/api/timetable.ics", baseUrl));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/text\/calendar/);
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(body).toContain("BEGIN:VEVENT");
    expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
});
