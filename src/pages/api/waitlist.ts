import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, joinWaitlist } from "../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../lib/services/http";

// POST {optionId}. 303 back with ?msg=waitlisted or ?error=<code>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const optionId = field(form, "optionId");
  if (!optionId) return redirectTo(request, form, { fallback: "/timetable/", error: "invalid", detail: "optionId is required." });
  return respond(request, form, joinWaitlist(DEFAULT_STUDENT_ID, optionId), "waitlisted", { fallback: "/timetable/" });
};
