import type { APIRoute } from "astro";
import { DEFAULT_STUDENT_ID, newDraft } from "../../../lib/services/alloc";
import { field, readForm, redirectTo } from "../../../lib/services/http";

// POST {name?}. Opens a draft (or reuses the open one). 303 to /draft/ (or `next`) with ?msg=draft-created.
export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  newDraft(DEFAULT_STUDENT_ID, field(form, "name") ?? undefined);
  return redirectTo(request, form, { fallback: "/draft/", fixed: true, msg: "draft-created" });
};
