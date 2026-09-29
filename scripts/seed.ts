// `pnpm db:seed [--strict] [--reset] [--path file]`: validate and load seed/sem2-2026.json into the database.
// Upsert by id; the student's existing allocations are kept unless --reset (which wipes every app table first).
// --strict rejects TODO markers (fails while any group or weeks value is still TODO).
// Runs under Node's native TypeScript support like scripts/check-evidence.ts. Workstream D owns this file.
import { reseed } from "../src/lib/seed/load.ts";

const args = process.argv.slice(2);
const pathIdx = args.indexOf("--path");
try {
  const stats = reseed({
    strict: args.includes("--strict"),
    reset: args.includes("--reset"),
    path: pathIdx >= 0 ? args[pathIdx + 1] : undefined,
    log: (m) => console.warn(`[seed] ${m}`),
  });
  console.log(
    `[seed] ok: ${stats.courses} courses, ${stats.groups} groups, ${stats.options} options, ${stats.sessions} sessions, ` +
      `${stats.allocations} new allocations, ${stats.placeholders} placeholder students` +
      (stats.skipped.length ? `; skipped (TODO): ${stats.skipped.join(", ")}` : ""),
  );
} catch (e) {
  console.error(`[seed] FAILED\n${(e as Error).message}`);
  process.exitCode = 1;
}
