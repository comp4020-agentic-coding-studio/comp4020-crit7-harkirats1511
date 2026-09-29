import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateSeed } from "./validate.ts";

const real = () => JSON.parse(readFileSync("seed/sem2-2026.json", "utf8"));

const tiny = () => ({
  term: { id: "t", name: "T", startDate: "2026-07-27", teachingWeeks: 12, breakAfterWeek: 6 },
  courses: [
    {
      code: "ABCD1000",
      title: "Abcd",
      groups: [
        {
          kind: "tutorial",
          name: "Tut A",
          options: [
            { code: "01", capacity: 5, sessions: [{ day: "Mon", start: "09:00", end: "10:00", weeks: "1-6,7-12" }] },
            { code: "02", sessions: [{ day: "Tue", start: "09:00", end: "10:00", weeks: "28/7-1/9, 22/9-27/10" }] },
          ],
        },
      ],
    },
  ],
  allocations: [{ group: "abcd1000-tuta", option: "01" }],
});

describe("validateSeed", () => {
  it("accepts the real seed, strict too (no TODO left)", () => {
    for (const strict of [false, true]) {
      const r = validateSeed(real(), { strict });
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });
  it("accepts a tiny hand-written seed", () => {
    expect(validateSeed(tiny()).errors).toEqual([]);
  });

  const bad = (mutate: (s: any) => void, strict = false) => {
    const s = tiny();
    mutate(s);
    return validateSeed(s, { strict });
  };
  const opt0 = (s: any) => s.courses[0].groups[0].options[0];

  it("reports zod errors as path: message", () => {
    const r = bad((s) => (opt0(s).sessions[0].start = "9am"));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/^courses\.0\.groups\.0\.options\.0\.sessions\.0\.start: /);
  });
  it("start must be before end", () => {
    const r = bad((s) => (opt0(s).sessions[0].end = "09:00"));
    expect(r.errors).toContainEqual(expect.stringMatching(/sessions\.0\.end: end 09:00 must be after start 09:00/));
  });
  it("weeks: wrong weekday, break, out of term", () => {
    expect(bad((s) => (opt0(s).sessions[0].weeks = "28/7")).errors[0]).toMatch(/sessions\.0\.weeks: 28\/7 is a Tue, not a Mon/);
    expect(bad((s) => (opt0(s).sessions[0].weeks = "7/9")).errors[0]).toMatch(/mid-semester break/);
    expect(bad((s) => (opt0(s).sessions[0].weeks = "1-13")).errors[0]).toMatch(/outside teaching weeks/);
    expect(bad((s) => (opt0(s).sessions[0].weeks = "hello")).ok).toBe(false);
  });
  it("duplicate ids and codes", () => {
    expect(bad((s) => (s.courses[0].groups[0].options[1].code = "01")).errors.join("\n")).toMatch(/duplicate/);
    expect(bad((s) => s.courses.push({ ...s.courses[0] })).errors.join("\n")).toMatch(/duplicate course/);
  });
  it("enrolled must not exceed capacity", () => {
    expect(bad((s) => (opt0(s).enrolled = 6)).errors).toContainEqual(expect.stringMatching(/enrolled: 6 exceeds capacity 5/));
  });
  it("allocations must reference existing options", () => {
    expect(bad((s) => (s.allocations[0].option = "99")).errors[0]).toMatch(/^allocations\.0\.option: /);
    expect(bad((s) => (s.allocations[0].group = "nope")).errors[0]).toMatch(/^allocations\.0\.group: /);
  });
  it("TODO groups: warning in draft, error in strict", () => {
    const mut = (s: any) => s.courses[0].groups.push({ id: "abcd1000-luna", kind: "lab", name: "Lab A", options: "TODO" });
    const draft = bad(mut);
    expect(draft.ok).toBe(true);
    expect(draft.warnings.join()).toMatch(/abcd1000-luna/);
    const strict = bad(mut, true);
    expect(strict.ok).toBe(false);
    expect(strict.errors[0]).toMatch(/groups\.1\.options: TODO/);
  });
  it("TODO weeks: same rule", () => {
    const mut = (s: any) => (opt0(s).sessions[0].weeks = "TODO");
    expect(bad(mut).ok).toBe(true);
    expect(bad(mut, true).ok).toBe(false);
  });
  it("a group with an empty options list is an error", () => {
    expect(bad((s) => (s.courses[0].groups[0].options = [])).ok).toBe(false);
  });
  it("bad term", () => {
    expect(bad((s) => (s.term.startDate = "2026-07-28")).errors[0]).toMatch(/not a Monday/);
    expect(bad((s) => (s.term.breakAfterWeek = 12)).errors[0]).toMatch(/breakAfterWeek/);
  });
});
