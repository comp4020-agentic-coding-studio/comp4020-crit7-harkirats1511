import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, undoLatest } from "../../lib/services/alloc";
import { field, readForm, respond } from "../../lib/services/http";

// POST {batchId?} (default: newest not-yet-undone batch). 303 to /history/ (or `next`) with ?msg=undone
// or ?error=<full|stale|nothing_to_undo|not_found|invalid>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  return respond(request, form, undoLatest(DEFAULT_STUDENT_ID, field(form, "batchId") ?? undefined), "undone", {
    fallback: "/history/",
    fixed: true,
  });
};
