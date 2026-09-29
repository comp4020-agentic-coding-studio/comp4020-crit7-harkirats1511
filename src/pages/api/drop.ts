import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, dropGroup } from "../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../lib/services/http";

// POST {groupId, draftId?}. 303 back with ?msg=dropped (?msg=dropped-in-draft) or ?error=<code>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const groupId = field(form, "groupId");
  const draftId = field(form, "draftId");
  if (!groupId) return redirectTo(request, form, { fallback: "/timetable/", error: "invalid", detail: "groupId is required." });
  return respond(request, form, dropGroup(DEFAULT_STUDENT_ID, groupId, { draftId }), draftId ? "dropped-in-draft" : "dropped", {
    fallback: "/timetable/",
  });
};
