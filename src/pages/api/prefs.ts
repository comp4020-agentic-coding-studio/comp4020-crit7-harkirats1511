import type { APIRoute } from "astro";
import { defaultPrefs } from "../../lib/engine/prefs";
import { DEFAULT_STUDENT_ID, loadPrefs, savePrefs } from "../../lib/services/alloc";
import { field, type Form, readForm, redirectTo } from "../../lib/services/http";

// POST preferences. Either `prefs` = JSON of the Prefs object, `reset=1`, or these fields (blank = null/off):
//   daysOff (repeat, 0=Mon..6=Sun; none checked = no days off)
//   earliestStart, latestEnd  as "HH:MM"  (or earliestStartMin, latestEndMin as minutes since midnight)
//   maxGapMin, minWalkGapMin  minutes
//   weightDayOff, weightEarly, weightLate, weightGap, weightWalk  numbers (absent = keep stored)
// 303 to /preferences/ (or `next`) with ?msg=prefs-saved or ?error=invalid&detail=.
function minutes(form: Form, hhmm: string, mins: string, prev: number | null): number | null | "bad" {
  const hasA = form.get(hhmm) !== null;
  const hasB = form.get(mins) !== null;
  if (!hasA && !hasB) return prev;
  const v = field(form, hhmm) ?? field(form, mins);
  if (v === null) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d+$/.test(v) ? Number(v) : "bad";
}
function num(form: Form, key: string, prev: number | null): number | null | "bad" {
  if (form.get(key) === null) return prev;
  const v = field(form, key);
  if (v === null) return null;
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : "bad";
}

export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const back = { fallback: "/preferences/", fixed: true } as const;
  let raw: unknown;
  if (form.get("reset") === "1") raw = defaultPrefs();
  else if (field(form, "prefs")) {
    try {
      raw = JSON.parse(field(form, "prefs") as string);
    } catch {
      return redirectTo(request, form, { ...back, error: "invalid", detail: "Preferences JSON is malformed." });
    }
  } else {
    const prev = loadPrefs(DEFAULT_STUDENT_ID);
    const earliest = minutes(form, "earliestStart", "earliestStartMin", prev.earliestStartMin);
    const latest = minutes(form, "latestEnd", "latestEndMin", prev.latestEndMin);
    const gap = num(form, "maxGapMin", prev.maxGapMin);
    const walk = num(form, "minWalkGapMin", prev.minWalkGapMin);
    const w = {
      dayOff: num(form, "weightDayOff", prev.weights.dayOff),
      early: num(form, "weightEarly", prev.weights.early),
      late: num(form, "weightLate", prev.weights.late),
      gap: num(form, "weightGap", prev.weights.gap),
      walk: num(form, "weightWalk", prev.weights.walk),
    };
    const days = form.getAll("daysOff");
    if ([earliest, latest, gap, walk, ...Object.values(w)].includes("bad") || days.some((d) => !/^[0-6]$/.test(d)))
      return redirectTo(request, form, { ...back, error: "invalid", detail: "A preference field is not a valid number or time." });
    raw = {
      daysOff: [...new Set(days.map(Number))].sort(),
      earliestStartMin: earliest,
      latestEndMin: latest,
      maxGapMin: gap,
      minWalkGapMin: walk,
      weights: w,
    };
  }
  const r = savePrefs(DEFAULT_STUDENT_ID, raw);
  return r.ok
    ? redirectTo(request, form, { ...back, msg: "prefs-saved" })
    : redirectTo(request, form, { ...back, error: "invalid", detail: r.message });
};
