import type { APIRoute } from "astro";
import { applyDraft, DEFAULT_STUDENT_ID } from "../../../lib/services/alloc";
import { field, readForm, redirectTo } from "../../../lib/services/http";

// POST {draftId}. Success: 303 to /timetable/ (or `next`) with ?msg=draft-applied.
// Failure: 303 to /draft/ (or `next`) with ?error=<full|clash|stale|no_draft|invalid>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const draftId = field(form, "draftId");
  if (!draftId) return redirectTo(request, form, { fallback: "/draft/", fixed: true, error: "invalid", detail: "draftId is required." });
  const r = applyDraft(DEFAULT_STUDENT_ID, draftId);
  return r.ok
    ? redirectTo(request, form, { fallback: "/timetable/", fixed: true, msg: "draft-applied" })
    : redirectTo(request, form, { fallback: "/draft/", fixed: true, error: r.code, detail: r.message });
};
