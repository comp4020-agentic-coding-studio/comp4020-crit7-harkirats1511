import { sql } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
//
// Ids are text slugs (e.g. "2026s2", "comp4020", "comp4020-tuta", "comp4020-tuta-01") so the seed is
// hand-writable. Weeks are a bitmask over teaching weeks 1..13. Days are 0 = Monday. Times are minutes
// since midnight. Seats used = COUNT(allocations) per option, never a stored counter.
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

export const terms = sqliteTable("terms", {
  id: text().primaryKey(),
  name: text().notNull(),
  /** ISO Monday of teaching week 1. */
  startDate: text("start_date").notNull(),
  teachingWeeks: int("teaching_weeks").notNull().default(13),
  breakAfterWeek: int("break_after_week"),
});

export const courses = sqliteTable("courses", {
  id: text().primaryKey(),
  termId: text("term_id").notNull(),
  code: text().notNull(),
  title: text().notNull(),
});

// Cross-listed codes: display only; the canonical course owns the sessions and seat pool.
export const courseAliases = sqliteTable(
  "course_aliases",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseId: text("course_id").notNull(),
    code: text().notNull(),
  },
  (t) => [unique().on(t.courseId, t.code)],
);

export const activityGroups = sqliteTable("activity_groups", {
  id: text().primaryKey(),
  courseId: text("course_id").notNull(),
  /** lecture | tutorial | workshop | lab | dropin | other */
  kind: text().notNull(),
  name: text().notNull(),
  exemptFromClash: int("exempt_from_clash", { mode: "boolean" }).notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
});

export const options = sqliteTable("options", {
  id: text().primaryKey(),
  groupId: text("group_id").notNull(),
  code: text().notNull(),
  /** null = not published. */
  capacity: int(),
  campus: text(),
  staff: text(),
  sortOrder: int("sort_order").notNull().default(0),
});

export const sessions = sqliteTable("sessions", {
  id: text().primaryKey(),
  optionId: text("option_id").notNull(),
  /** "P1", "P2", ... */
  part: text().notNull().default("P1"),
  day: int().notNull(),
  startMin: int("start_min").notNull(),
  endMin: int("end_min").notNull(),
  /** WeekMask: bit (i-1) = teaching week i. */
  weeks: int().notNull(),
  location: text(),
});

export const students = sqliteTable("students", {
  id: text().primaryKey(),
  name: text().notNull(),
  createdAt: createdAt(),
});

export const allocations = sqliteTable(
  "allocations",
  {
    studentId: text("student_id").notNull(),
    groupId: text("group_id").notNull(),
    optionId: text("option_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.groupId] })],
);

export const waitlist = sqliteTable(
  "waitlist",
  {
    id: int().primaryKey({ autoIncrement: true }),
    studentId: text("student_id").notNull(),
    optionId: text("option_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.studentId, t.optionId)],
);

export const swapRequests = sqliteTable("swap_requests", {
  id: int().primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  groupId: text("group_id").notNull(),
  /** The option the student holds and offers. */
  haveOptionId: text("have_option_id").notNull(),
  /** The option the student wants. */
  wantOptionId: text("want_option_id").notNull(),
  /** open | matched | cancelled */
  status: text().notNull().default("open"),
  createdAt: createdAt(),
});

export const drafts = sqliteTable("drafts", {
  id: text().primaryKey(),
  studentId: text("student_id").notNull(),
  name: text().notNull(),
  /** open | applied | discarded */
  status: text().notNull().default("open"),
  createdAt: createdAt(),
});

// Overlay rows: optionId null = the draft drops that group. Absent group = unchanged from real.
export const draftAllocations = sqliteTable(
  "draft_allocations",
  {
    draftId: text("draft_id").notNull(),
    groupId: text("group_id").notNull(),
    optionId: text("option_id"),
  },
  (t) => [primaryKey({ columns: [t.draftId, t.groupId] })],
);

// One row per group change; rows sharing batchId are one atomic user action (undone together).
export const history = sqliteTable("history", {
  id: int().primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  batchId: text("batch_id").notNull(),
  groupId: text("group_id").notNull(),
  fromOptionId: text("from_option_id"),
  toOptionId: text("to_option_id"),
  /** select | drop | move | swap | draft | autofix | undo | waitlist */
  source: text().notNull(),
  /** For source = "undo": the batch this one reverses. */
  undoesBatchId: text("undoes_batch_id"),
  /** Set on the ORIGINAL batch's rows once an undo has reversed it. */
  undoneByBatchId: text("undone_by_batch_id"),
  createdAt: createdAt(),
});

// One row per student; `data` is JSON of engine Prefs (validated by engine parsePrefs).
export const preferences = sqliteTable("preferences", {
  studentId: text("student_id").primaryKey(),
  data: text().notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
