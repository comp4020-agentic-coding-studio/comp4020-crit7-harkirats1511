// What the result toast says after a form POST redirects back (?msg= / ?error=), in plain words, plus the Undo it
// can offer. Success messages name the actual change from the newest history batch ("Your COMP3900 tutorial is now
// Wed 4–5:30pm."), so the student sees what happened, not a code.
import { className, primarySlot, slotWhen } from "./daybook";
import type { Catalog } from "./engine/types";
import { DEFAULT_STUDENT_ID, loadHistory } from "./services/alloc";
import { errorText } from "./view";

export interface Result {
  kind: "ok" | "error";
  text: string;
  undo: { action: string; fields: Record<string, string>; label: string } | null;
}

function describe(catalog: Catalog, entries: { groupId: string; toOptionId: string | null }[], undone: boolean): string {
  const first = entries[0];
  if (!first) return undone ? "Undone." : "Done.";
  const name = className(catalog, first.groupId);
  const opt = first.toOptionId ? catalog.options.get(first.toOptionId) : undefined;
  const group = catalog.groups.get(first.groupId);
  const slot = opt && group ? primarySlot(opt, group) : null;
  let s: string;
  if (!first.toOptionId) s = undone ? `Your ${name} is dropped again.` : `Dropped your ${name}.`;
  else s = `${undone ? "Undone. " : ""}Your ${name} is ${undone ? "back to" : "now"} ${slot ? slotWhen(slot) : "changed"}.`;
  if (entries.length > 1) s += ` ${entries.length - 1 === 1 ? "One other class" : `${entries.length - 1} other classes`} changed too.`;
  return s;
}

const SIMPLE: Record<string, string> = {
  "selected-in-draft": "Changed in your draft only.",
  "dropped-in-draft": "Dropped in your draft only.",
  "moved-in-draft": "Moved in your draft only.",
  waitlisted: "You’re on the waitlist.",
  "swap-requested": "Swap requested.",
  "draft-created": "Draft started. Changes stay in it until you apply it.",
  "draft-restored": "Draft restored.",
  "prefs-saved": "Preferences saved.",
};

export function resultFor(url: URL, catalog: Catalog): Result | null {
  const p = url.searchParams;
  const error = p.get("error");
  if (error) {
    const detail = p.get("detail");
    return { kind: "error", text: `Not done. ${errorText(error)}${detail ? ` ${detail}` : ""}`, undo: null };
  }
  const msg = p.get("msg");
  if (!msg) return null;
  if (SIMPLE[msg]) return { kind: "ok", text: SIMPLE[msg], undo: null };
  if (msg === "draft-discarded") {
    const id = p.get("draft");
    return { kind: "ok", text: "Draft discarded.", undo: id ? { action: "/api/draft/restore", fields: { draftId: id }, label: "Undo" } : null };
  }
  const latest = loadHistory(DEFAULT_STUDENT_ID, 1)[0];
  if (msg === "undone") return { kind: "ok", text: latest?.source === "undo" ? describe(catalog, latest.entries, true) : "Undone.", undo: null };
  const text = latest ? describe(catalog, latest.entries, false) : "Done.";
  return { kind: "ok", text, undo: latest?.undoable ? { action: "/api/undo", fields: { batchId: latest.batchId }, label: "Undo" } : null };
}

/** Where Undo should land: this page without the result params. */
export function backHere(url: URL): string {
  const u = new URL(url);
  for (const k of ["msg", "error", "detail", "draft", "pick"]) u.searchParams.delete(k);
  return u.pathname + u.search;
}
