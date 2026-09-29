import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { client } from "../db.ts";
import { DAY_NAMES, myttWeeksToMask, type WeekTerm } from "./mytt-weeks.ts";
import type { SeedFile } from "./schema.ts";
import {
  courseIdOf,
  groupIdOf,
  optionIdOf,
  sessionIdOf,
  validateSeed,
  type ValidateOptions,
} from "./validate.ts";

/** Default seed file path, relative to the repo root (Dockerfile must copy it). */
export const SEED_PATH = "seed/sem2-2026.json";

export interface SeedStats {
  courses: number;
  groups: number;
  options: number;
  sessions: number;
  allocations: number;
  placeholders: number;
  /** Ids of groups (and options) skipped because they still carry TODO markers. */
  skipped: string[];
}

export type LoadOptions = ValidateOptions & { path?: string; log?: (msg: string) => void };

/**
 * Resolve the seed file: an explicit path or the cwd-relative default first; otherwise walk up from this module
 * (works from src/lib/seed and from the bundled dist/server chunks) looking for SEED_PATH.
 */
function resolveSeedPath(explicit?: string): string {
  const primary = resolve(explicit ?? SEED_PATH);
  if (explicit || existsSync(primary)) return primary;
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      const candidate = join(dir, SEED_PATH);
      if (existsSync(candidate)) return candidate;
      dir = dirname(dir);
    }
  } catch {
    // import.meta.url unavailable: fall through to the cwd path (readSeed reports it)
  }
  return primary;
}

/** Read and validate a seed file. Throws with all "path: message" errors if invalid. */
export function readSeed(opts?: LoadOptions): { seed: SeedFile; warnings: string[] } {
  const file = resolveSeedPath(opts?.path);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: cannot read seed (${(e as Error).message})`);
  }
  const res = validateSeed(json, opts);
  if (!res.ok || !res.seed) throw new Error(`Invalid seed ${file}:\n${res.errors.join("\n")}`);
  return { seed: res.seed, warnings: res.warnings };
}

const APP_TABLES = [
  "draft_allocations",
  "drafts",
  "history",
  "waitlist",
  "swap_requests",
  "preferences",
  "allocations",
  "students",
  "sessions",
  "options",
  "activity_groups",
  "course_aliases",
  "courses",
  "terms",
];

/**
 * Write a validated seed in ONE transaction. Upsert semantics: rows are inserted or updated by id, sessions of
 * seeded options are replaced, rows not in the seed are left alone, and the student's existing allocations are kept
 * (starting allocations only fill groups the student has not chosen). `reset` wipes every app table first.
 */
export function loadSeed(seed: SeedFile, opts?: { reset?: boolean; log?: (msg: string) => void }): SeedStats {
  const log = opts?.log ?? (() => {});
  const stats: SeedStats = { courses: 0, groups: 0, options: 0, sessions: 0, allocations: 0, placeholders: 0, skipped: [] };
  const term = seed.term;
  const weekTerm: WeekTerm = {
    startDate: term.startDate,
    teachingWeeks: term.teachingWeeks,
    breakAfterWeek: term.breakAfterWeek,
  };

  const upTerm = client.prepare(
    `INSERT INTO terms (id, name, start_date, teaching_weeks, break_after_week) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, start_date = excluded.start_date,
       teaching_weeks = excluded.teaching_weeks, break_after_week = excluded.break_after_week`,
  );
  const upCourse = client.prepare(
    `INSERT INTO courses (id, term_id, code, title) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET term_id = excluded.term_id, code = excluded.code, title = excluded.title`,
  );
  const upAlias = client.prepare(`INSERT OR IGNORE INTO course_aliases (course_id, code) VALUES (?, ?)`);
  const upGroup = client.prepare(
    `INSERT INTO activity_groups (id, course_id, kind, name, exempt_from_clash, sort_order) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET course_id = excluded.course_id, kind = excluded.kind, name = excluded.name,
       exempt_from_clash = excluded.exempt_from_clash, sort_order = excluded.sort_order`,
  );
  const upOption = client.prepare(
    `INSERT INTO options (id, group_id, code, capacity, campus, staff, overflow, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET group_id = excluded.group_id, code = excluded.code, capacity = excluded.capacity,
       campus = excluded.campus, staff = excluded.staff, overflow = excluded.overflow, sort_order = excluded.sort_order`,
  );
  const delSessions = client.prepare(`DELETE FROM sessions WHERE option_id = ?`);
  const insSession = client.prepare(
    `INSERT INTO sessions (id, option_id, part, day, start_min, end_min, weeks, location, exempt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upStudent = client.prepare(
    `INSERT INTO students (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  );
  const insStudent = client.prepare(`INSERT OR IGNORE INTO students (id, name) VALUES (?, ?)`);
  const insAlloc = client.prepare(
    `INSERT OR IGNORE INTO allocations (student_id, group_id, option_id) VALUES (?, ?, ?)`,
  );

  const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

  const run = client.transaction(() => {
    if (opts?.reset) for (const t of APP_TABLES) client.prepare(`DELETE FROM ${t}`).run();

    upTerm.run(term.id, term.name, term.startDate, term.teachingWeeks, term.breakAfterWeek);
    upStudent.run(seed.student.id, seed.student.name);

    const optionIdByGroupCode = new Map<string, Map<string, string>>();
    for (const course of seed.courses) {
      const cid = courseIdOf(course);
      upCourse.run(cid, term.id, course.code, course.title);
      stats.courses++;
      for (const alias of course.aliases) upAlias.run(cid, alias);

      course.groups.forEach((group, gi) => {
        const gid = groupIdOf(cid, group);
        if (group.options === "TODO") {
          stats.skipped.push(gid);
          log(`warning: skipping group ${gid}: options are TODO`);
          return;
        }
        upGroup.run(gid, cid, group.kind, group.name, group.exemptFromClash ? 1 : 0, gi);
        stats.groups++;
        const codes = new Map<string, string>();
        optionIdByGroupCode.set(gid, codes);

        group.options.forEach((opt, oi) => {
          const oid = optionIdOf(gid, opt);
          // Compute every session's mask first so a TODO week skips the whole option atomically.
          const rows: unknown[][] = [];
          let todo = false;
          for (const ses of opt.sessions) {
            if (ses.weeks === "TODO") {
              todo = true;
              break;
            }
            rows.push([
              sessionIdOf(oid, ses.part),
              oid,
              ses.part,
              DAY_NAMES.indexOf(ses.day),
              hm(ses.start),
              hm(ses.end),
              myttWeeksToMask(ses.weeks, ses.day, weekTerm),
              ses.location ?? null,
              ses.dropIn ? 1 : 0,
            ]);
          }
          if (todo) {
            stats.skipped.push(oid);
            log(`warning: skipping option ${oid}: weeks are TODO`);
            return;
          }
          upOption.run(oid, gid, opt.code, opt.capacity ?? null, opt.campus ?? null, opt.staff ?? null, opt.overflow ? 1 : 0, oi);
          stats.options++;
          delSessions.run(oid);
          for (const r of rows) insSession.run(...r);
          stats.sessions += rows.length;
          codes.set(opt.code.toLowerCase(), oid);

          for (let n = 1; n <= opt.enrolled; n++) {
            const sid = `enrolled-${oid}-${n}`;
            insStudent.run(sid, "Enrolled student");
            insAlloc.run(sid, gid, oid);
            stats.placeholders++;
          }
        });
      });
    }

    for (const a of seed.allocations) {
      const oid = optionIdByGroupCode.get(a.group)?.get(a.option.toLowerCase());
      if (!oid) {
        log(`warning: allocation ${a.group}/${a.option} skipped (option not loaded)`);
        continue;
      }
      // Keep the student's own later choices: only fill groups they have no allocation in (unless reset).
      const res = insAlloc.run(seed.student.id, a.group, oid);
      stats.allocations += res.changes;
    }
  });
  run.immediate();
  return stats;
}

/**
 * Idempotent: if the `terms` table is empty, validate SEED_PATH and insert term, courses, aliases, groups,
 * options, sessions, the student and placeholder students (`enrolled`) with their allocations, all in one
 * transaction; otherwise do nothing. Safe to call on every boot and from spec/global-setup.ts (which sets
 * DATABASE_PATH first). Returns true if it inserted. Throws with all "path: message" errors if invalid.
 * TODO groups are skipped with a logged warning.
 */
export function seedIfEmpty(opts?: LoadOptions): boolean {
  const row = client.prepare(`SELECT COUNT(*) AS n FROM terms`).get() as { n: number };
  if (row.n > 0) return false;
  const { seed, warnings } = readSeed(opts);
  const log = opts?.log ?? ((m: string) => console.warn(`[seed] ${m}`));
  for (const w of warnings) log(`warning: ${w}`);
  loadSeed(seed, { log });
  return true;
}

/** Upsert reseed for `pnpm db:seed`: non-destructive of allocations unless `reset`. */
export function reseed(opts?: LoadOptions & { reset?: boolean }): SeedStats {
  const { seed, warnings } = readSeed(opts);
  const log = opts?.log ?? ((m: string) => console.warn(`[seed] ${m}`));
  for (const w of warnings) log(`warning: ${w}`);
  return loadSeed(seed, { reset: opts?.reset, log });
}
