import type { APIRoute } from "astro";
import { buildIcs } from "../../lib/engine/ical";
import { DEFAULT_STUDENT_ID, loadAllocation, loadCatalog } from "../../lib/services/alloc";

// GET: the student's REAL allocation as an iCalendar file (engine buildIcs), downloaded as an attachment.
export const GET: APIRoute = () => {
  const catalog = loadCatalog();
  const term = [...catalog.terms.values()][0];
  if (!term) return new Response("No term loaded.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const ics = buildIcs(loadAllocation(DEFAULT_STUDENT_ID), catalog, term, { calName: `${term.name} timetable` });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="timetable.ics"',
      "cache-control": "no-store",
    },
  });
};
