import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, restoreDraft } from "../../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../../lib/services/http";

// POST {draftId}. Undoes a discard: reopens that draft with its changes. 303 to /draft/ (or `next`) with
// ?msg=draft-restored or ?error=<no_draft|invalid>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const draftId = field(form, "draftId");
  if (!draftId) return redirectTo(request, form, { fallback: "/draft/", fixed: true, error: "invalid", detail: "draftId is required." });
  return respond(request, form, restoreDraft(DEFAULT_STUDENT_ID, draftId), "draft-restored", { fallback: "/draft/", fixed: true });
};
