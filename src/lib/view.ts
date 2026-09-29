// Shared per-request view state for every page (workstream F). Pages and the Shell call this once and
// pass the result down; it only reads (services in alloc.ts), never writes.
import { effectiveAlloc } from "./engine/draft";
import { range12, time12, weeksWords } from "./daybook";
import type { Allocation, Catalog, ClashDetail, Course, Group, Option, Prefs, Session, SeatsUsed, Term } from "./engine/types";
import {
  DEFAULT_STUDENT_ID,
  type Draft,
  getOpenDraft,
  loadAllocation,
  loadCatalog,
  loadDraftOverlay,
  loadPrefs,
  seatsUsed,
} from "./services/alloc";

export interface ViewState {
  catalog: Catalog;
  term: Term;
  /** The student's real timetable. */
  realAlloc: Allocation;
  /** What to display: real, overlaid with the open draft when one is open. */
  alloc: Allocation;
  /** The open draft, or null. */
  draft: Draft | null;
  seats: SeatsUsed;
  prefs: Prefs;
  /** ?msg=<code> (success) */
  msg: string | null;
  /** ?error=<code> */
  error: string | null;
  /** ?detail=<text> */
  detail: string | null;
}

export function getViewState(url: URL): ViewState {
  const catalog = loadCatalog();
  const term = [...catalog.terms.values()][0];
  const realAlloc = loadAllocation(DEFAULT_STUDENT_ID);
  const draft = getOpenDraft(DEFAULT_STUDENT_ID);
  const alloc = draft ? effectiveAlloc(realAlloc, loadDraftOverlay(draft.id)) : realAlloc;
  const p = url.searchParams;
  return {
    catalog,
    term,
    realAlloc,
    alloc,
    draft,
    seats: seatsUsed(),
    prefs: loadPrefs(DEFAULT_STUDENT_ID),
    msg: p.get("msg"),
    error: p.get("error"),
    detail: p.get("detail"),
  };
}

// ---------- formatting helpers shared by components ----------

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 12-hour everywhere: "2pm", "10:30am". */
export function fmtTime(min: number): string {
  return time12(min);
}

/** "2–3:30pm" */
export function fmtRange(s: Pick<Session, "startMin" | "endMin">): string {
  return range12(s.startMin, s.endMin);
}

export function optionLabel(group: Group, option: Option): string {
  return `${group.name} ${option.code}`;
}

/** Find a course by code (case-insensitive), alias code, or id. */
export function findCourse(catalog: Catalog, key: string): Course | null {
  const k = key.trim().toLowerCase();
  for (const c of catalog.courses.values()) {
    if (c.id.toLowerCase() === k || c.code.toLowerCase() === k) return c;
  }
  for (const c of catalog.courses.values()) {
    if (c.aliases.some((a) => a.toLowerCase() === k)) return c;
  }
  return null;
}

/** "Wed 10:30-12:00" for the first session of an option (plus "+N" when multi-part). */
export function optionWhen(option: Option): string {
  const s = option.sessions[0];
  if (!s) return "Not published";
  return `${DAY_NAMES[s.day]} ${fmtRange(s)}${option.sessions.length > 1 ? ` (+${option.sessions.length - 1} more)` : ""}`;
}

const MSGS: Record<string, string> = {
  selected: "Option selected.",
  "selected-in-draft": "Option selected in the draft (your real timetable is unchanged).",
  dropped: "Class dropped.",
  "dropped-in-draft": "Class dropped in the draft (your real timetable is unchanged).",
  moved: "Classes moved.",
  "moved-in-draft": "Classes moved in the draft (your real timetable is unchanged).",
  waitlisted: "You are on the waitlist for that option.",
  "swap-requested": "Swap requested.",
  "draft-created": "Draft opened. Changes now go to the draft, not your real timetable.",
  "draft-applied": "Draft applied to your real timetable.",
  "draft-discarded": "Draft discarded.",
  undone: "Last change undone.",
  autofixed: "Clashes fixed.",
  "prefs-saved": "Preferences saved.",
};

const ERRORS: Record<string, string> = {
  not_found: "That option or class no longer exists.",
  full: "That option is full.",
  clash: "That change would clash with another class.",
  invalid: "That request was not valid.",
  stale: "Your timetable changed since this page loaded. Nothing was changed.",
  no_draft: "There is no open draft.",
  nothing_to_undo: "There is nothing to undo.",
};

export function msgText(code: string): string {
  return MSGS[code] ?? code.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) + ".";
}
export function errorText(code: string): string {
  return ERRORS[code] ?? "Something went wrong.";
}

/** "Tut A 04" */
export function optionName(catalog: Catalog, optionId: string): string {
  const o = catalog.options.get(optionId);
  const g = o && catalog.groups.get(o.groupId);
  return o && g ? optionLabel(g, o) : optionId;
}

/** "COMP4020 Tut A 04" */
export function optionFullName(catalog: Catalog, optionId: string): string {
  const o = catalog.options.get(optionId);
  const g = o && catalog.groups.get(o.groupId);
  const c = g && catalog.courses.get(g.courseId);
  return o && g && c ? `${c.code} ${optionLabel(g, o)}` : optionId;
}

export function courseOfOption(catalog: Catalog, optionId: string): Course | null {
  const o = catalog.options.get(optionId);
  const g = o && catalog.groups.get(o.groupId);
  return (g && catalog.courses.get(g.courseId)) || null;
}

/** "Wed 11am–12pm, weeks 2–12" for each overlapping session pair, joined by "; ". */
export function clashWhen(c: ClashDetail, _term?: Term): string {
  return c.overlaps.map((o) => `${DAY_NAMES[o.day]} ${range12(o.fromMin, o.toMin)}, ${weeksWords(o.weeks)}`).join("; ");
}
