import type { APIRoute } from "astro";
import type { Move } from "../../lib/engine/types";
import { DEFAULT_STUDENT_ID, moveBatch } from "../../lib/services/alloc";
import { field, type Form, readForm, redirectTo, respond } from "../../lib/services/http";

// POST one atomic batch, validated jointly. Either
//   moves = JSON [{groupId, fromOptionId, toOptionId}, ...]   or
//   parallel repeated fields groupId / fromOptionId / toOptionId (blank = null; blank from = "whatever is held").
// Optional: draftId, force=1 (accept clashes), next. 303 back with ?msg=moved (?msg=moved-in-draft) or ?error=<code>&detail=.
// On error=clash the offending clash details are not in the URL; the resolve panel recomputes them.
function parseMoves(form: Form): Move[] | null {
  const raw = field(form, "moves");
  const norm = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (raw) {
    try {
      const j: unknown = JSON.parse(raw);
      if (!Array.isArray(j) || j.length === 0 || j.length > 50) return null;
      const out: Move[] = [];
      for (const m of j) {
        const groupId = norm(m?.groupId);
        if (!groupId) return null;
        out.push({ groupId, fromOptionId: norm(m?.fromOptionId), toOptionId: norm(m?.toOptionId) });
      }
      return out;
    } catch {
      return null;
    }
  }
  const g = form.getAll("groupId");
  const f = form.getAll("fromOptionId");
  const t = form.getAll("toOptionId");
  if (g.length === 0 || g.length > 50 || t.length !== g.length || (f.length !== 0 && f.length !== g.length)) return null;
  const out: Move[] = [];
  for (let i = 0; i < g.length; i++) {
    const groupId = norm(g[i]);
    if (!groupId) return null;
    out.push({ groupId, fromOptionId: f.length ? norm(f[i]) : null, toOptionId: norm(t[i]) });
  }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const draftId = field(form, "draftId");
  const moves = parseMoves(form);
  if (!moves) return redirectTo(request, form, { fallback: "/timetable/", error: "invalid", detail: "Malformed moves." });
  const r = moveBatch(DEFAULT_STUDENT_ID, moves, "move", { draftId, force: form.get("force") === "1" });
  return respond(request, form, r, draftId ? "moved-in-draft" : "moved", { fallback: "/timetable/" });
};
