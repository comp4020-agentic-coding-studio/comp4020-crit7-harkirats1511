// Shared helpers for the form-POST endpoints: parse input, answer 303 back with a ?msg= / ?error= code.
// Redirect target: the form's `next` (same-site path only), else the Referer's path+query, else `fallback`.
// The query always gains exactly one of `msg=<code>` (success) or `error=<FailCode>&detail=<text>` (failure);
// stale msg/error/detail params are removed first. On success `pick` is stripped too (the resolve panel is done).
import type { FailCode, MutationResult } from "./alloc";

export type Form = { get(k: string): string | null; getAll(k: string): string[] };

export async function readForm(request: Request): Promise<Form> {
  try {
    const fd = await request.formData();
    const str = (v: FormDataEntryValue) => (typeof v === "string" ? v : "");
    return {
      get: (k) => {
        const v = fd.get(k);
        return v === null ? null : str(v);
      },
      getAll: (k) => fd.getAll(k).map(str),
    };
  } catch {
    return { get: () => null, getAll: () => [] };
  }
}

/** A trimmed non-empty string field or null. */
export function field(form: Form, key: string): string | null {
  const v = form.get(key)?.trim();
  return v ? v : null;
}

function safePath(p: string | null | undefined): string | null {
  if (!p) return null;
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return null;
  return p;
}

function refererPath(request: Request): string | null {
  const ref = request.headers.get("referer");
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return safePath(u.pathname + u.search);
  } catch {
    return null;
  }
}

export interface RedirectOpts {
  fallback: string;
  /** Ignore Referer and use `fallback` (still honours a form `next`). */
  fixed?: boolean;
  msg?: string;
  error?: FailCode | "invalid";
  detail?: string;
  /** Extra params to set (undefined values skipped). */
  params?: Record<string, string | undefined>;
  /** Keep `pick` on success. */
  keepPick?: boolean;
}

export function redirectTo(request: Request, form: Form, o: RedirectOpts): Response {
  const base = safePath(field(form, "next")) ?? (o.fixed ? null : refererPath(request)) ?? o.fallback;
  const u = new URL(base, "http://local");
  for (const k of ["msg", "error", "detail"]) u.searchParams.delete(k);
  if (!o.error && !o.keepPick) u.searchParams.delete("pick");
  if (o.msg) u.searchParams.set("msg", o.msg);
  if (o.error) u.searchParams.set("error", o.error);
  if (o.error && o.detail) u.searchParams.set("detail", o.detail.slice(0, 200));
  for (const [k, v] of Object.entries(o.params ?? {})) if (v !== undefined) u.searchParams.set(k, v);
  return new Response(null, { status: 303, headers: { location: u.pathname + u.search } });
}

/** Redirect for a MutationResult: success -> msg, failure -> error + detail. */
export function respond(request: Request, form: Form, r: MutationResult, okMsg: string, o: Omit<RedirectOpts, "msg" | "error" | "detail">): Response {
  if (r.ok) return redirectTo(request, form, { ...o, msg: okMsg });
  return redirectTo(request, form, { ...o, error: r.code, detail: r.message });
}
