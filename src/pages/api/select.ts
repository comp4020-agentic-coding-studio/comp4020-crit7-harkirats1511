import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, loadCatalog, selectOption } from "../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../lib/services/http";

// POST {optionId, draftId?, force?}. Success: 303 back (Referer / `next`) with ?msg=selected (?msg=selected-in-draft for a draft).
// Clash without force=1: 303 to /course/<CODE>/?pick=<optionId>[&draftId=<id>] (the resolve panel).
// Other failures: 303 back with ?error=<code>&detail=<text> (codes: not_found full invalid no_draft).
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const optionId = field(form, "optionId");
  const draftId = field(form, "draftId");
  if (!optionId) return redirectTo(request, form, { fallback: "/timetable/", error: "invalid", detail: "optionId is required." });
  const r = selectOption(DEFAULT_STUDENT_ID, optionId, { draftId, force: form.get("force") === "1" });
  if (!r.ok && r.code === "clash") {
    const catalog = loadCatalog();
    const group = catalog.groups.get(catalog.options.get(optionId)?.groupId ?? "");
    const course = group && catalog.courses.get(group.courseId);
    if (course) {
      const q = new URLSearchParams({ pick: optionId });
      if (draftId) q.set("draftId", draftId);
      return new Response(null, { status: 303, headers: { location: `/course/${encodeURIComponent(course.code)}/?${q}` } });
    }
  }
  return respond(request, form, r, draftId ? "selected-in-draft" : "selected", { fallback: "/timetable/" });
};
