// Zod types for seed/sem2-2026.json (course > group > option > sessions). FINAL contract; workstream D owns it.
// Ids not given are derived by the loader as slugs: course "comp4020", group "comp4020-tuta", option "comp4020-tuta-01",
// session "<optionId>-p1". Weeks are strings like "1-6,8-12" (engine parseWeeks). Times are "HH:MM" 24h. Days "Mon".."Sun".
// "TODO" markers are allowed in draft mode and rejected under --strict.
import { z } from "zod";

const todo = z.literal("TODO");
export const dayName = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
export const timeText = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");
export const weeksText = z.string().regex(/^\d{1,2}(-\d{1,2})?(,\d{1,2}(-\d{1,2})?)*$/, 'expected e.g. "1-6,8-12"');

export const seedSession = z.object({
  part: z.string().default("P1"),
  day: dayName,
  start: timeText,
  end: timeText,
  weeks: weeksText.or(todo),
  location: z.string().nullable().optional(),
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
  sessions: z.array(seedSession).min(1),
});

export const seedGroup = z.object({
  id: z.string().optional(),
  kind: z.enum(["lecture", "tutorial", "workshop", "lab", "dropin", "other"]),
  name: z.string(),
  exemptFromClash: z.boolean().default(false),
  options: z.array(seedOption).min(1),
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
  teachingWeeks: z.number().int().default(13),
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
