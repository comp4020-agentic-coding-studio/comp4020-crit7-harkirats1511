import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, requestSwap } from "../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../lib/services/http";

// POST {groupId, wantOptionId}. 303 back with ?msg=swap-requested or ?error=<code>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const groupId = field(form, "groupId");
  const wantOptionId = field(form, "wantOptionId");
  if (!groupId || !wantOptionId)
    return redirectTo(request, form, { fallback: "/timetable/", error: "invalid", detail: "groupId and wantOptionId are required." });
  return respond(request, form, requestSwap(DEFAULT_STUDENT_ID, groupId, wantOptionId), "swap-requested", { fallback: "/timetable/" });
};
