import type { APIRoute } from "astro";
import { autofixConfirm, DEFAULT_STUDENT_ID } from "../../lib/services/alloc";
import { field, readForm, redirectTo, respond } from "../../lib/services/http";

// POST {basis}: confirm the previewed autofix (basis comes from autofixPreview). 303 to /auto-fix/ (or `next`)
// with ?msg=autofixed or ?error=<stale|invalid>&detail=.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const basis = field(form, "basis");
  if (!basis) return redirectTo(request, form, { fallback: "/auto-fix/", fixed: true, error: "invalid", detail: "basis is required." });
  return respond(request, form, autofixConfirm(DEFAULT_STUDENT_ID, basis), "autofixed", { fallback: "/auto-fix/", fixed: true });
};
