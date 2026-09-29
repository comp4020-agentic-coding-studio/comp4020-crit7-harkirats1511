// Zod types for seed/sem2-2026.json (course > group > option > sessions). FINAL contract; workstream D owns it.
// Ids not given are derived by the loader as slugs: course "comp4020", group "comp4020-tuta", option "comp4020-tuta-01",
// session "<optionId>-p1". Weeks are strings like "1-6,8-12" (engine parseWeeks). Times are "HH:MM" 24h. Days "Mon".."Sun".
// "TODO" markers are allowed in draft mode and rejected under --strict.
import { z } from "zod";

const todo = z.literal("TODO");
export const dayName = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
export const timeText = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");
const teachingWeeksText = /^\d{1,2}(-\d{1,2})?(,\d{1,2}(-\d{1,2})?)*$/;
// Additive: MyTT raw date strings such as "27/7-31/8, 21/9-28/9, 6/10" are also accepted (converted by mytt-weeks.ts).
const myttDatesText = /^\d{1,2}\/\d{1,2}(-\d{1,2}\/\d{1,2})?(\s*,\s*\d{1,2}\/\d{1,2}(-\d{1,2}\/\d{1,2})?)*$/;
export const weeksText = z
  .string()
  .refine((v) => teachingWeeksText.test(v) || myttDatesText.test(v), {
    message: 'expected teaching weeks like "1-6,8-12" or MyTT dates like "27/7-31/8, 21/9-28/9"',
  });

export const seedSession = z.object({
  part: z.string().default("P1"),
  day: dayName,
  start: timeText,
  end: timeText,
  weeks: weeksText.or(todo),
  location: z.string().nullable().optional(),
  /** Drop-in session: clash-exempt (maps to sessions.exempt). */
  dropIn: z.boolean().default(false),
});

export const seedOption = z.object({
  id: z.string().optional(),
  /** Display code within the group, e.g. "01". */
  code: z.string(),
  /** null/omitted = not published. */
  capacity: z.number().int().nonnegative().nullable().optional(),
  /** Placeholder students inserted so seats used matches MyTT. Must be <= capacity when both are set. */
  enrolled: z.number().int().nonnegative().default(0),
  campus: z.string().nullable().optional(),
  staff: z.string().nullable().optional(),
  /** Overflow/virtual clone option (e.g. "01_Clone"). */
  overflow: z.boolean().default(false),
  sessions: z.array(seedSession).min(1),
});

export const seedGroup = z.object({
  id: z.string().optional(),
  kind: z.enum(["lecture", "tutorial", "workshop", "lab", "dropin", "other"]),
  name: z.string(),
  exemptFromClash: z.boolean().default(false),
  /** "TODO" = the student has not supplied this group's options yet (draft mode only; the loader skips it). */
  options: z.array(seedOption).min(1).or(todo),
});

export const seedCourse = z.object({
  id: z.string().optional(),
  code: z.string(),
  title: z.string(),
  aliases: z.array(z.string()).default([]),
  groups: z.array(seedGroup),
});

export const seedTerm = z.object({
  id: z.string(),
  name: z.string(),
  /** ISO Monday of teaching week 1. */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Real term: startDate 2026-07-27, teachingWeeks 12, breakAfterWeek 6. */
  teachingWeeks: z.number().int().min(1).max(13).default(13),
  breakAfterWeek: z.number().int().nullable().default(null),
});

export const seedStudent = z.object({ id: z.string(), name: z.string() });

/** Which real options the single UI student already holds at first boot: groupId (or slug) -> option code. */
export const seedAllocation = z.object({ group: z.string(), option: z.string() });

export const seedFile = z.object({
  term: seedTerm,
  student: seedStudent.default({ id: "me", name: "Me" }),
  courses: z.array(seedCourse),
  /** Allocations for `student`; option is an option code within the group. */
  allocations: z.array(seedAllocation).default([]),
});

export type SeedSession = z.infer<typeof seedSession>;
export type SeedOption = z.infer<typeof seedOption>;
export type SeedGroup = z.infer<typeof seedGroup>;
export type SeedCourse = z.infer<typeof seedCourse>;
export type SeedFile = z.infer<typeof seedFile>;
