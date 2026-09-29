import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, discardDraft } from "../../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../../lib/services/http";

// POST {draftId}. 303 to /draft/ (or `next`) with ?msg=draft-discarded&draft=<id> (so the result toast can offer
// Undo via /api/draft/restore) or ?error=<no_draft|invalid>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const draftId = field(form, "draftId");
  if (!draftId) return redirectTo(request, form, { fallback: "/draft/", fixed: true, error: "invalid", detail: "draftId is required." });
  return respond(request, form, discardDraft(DEFAULT_STUDENT_ID, draftId), "draft-discarded", { fallback: "/draft/", fixed: true, params: { draft: draftId } });
};
