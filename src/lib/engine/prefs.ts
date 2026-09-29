import type { Allocation, Catalog, Day, Prefs, PrefPenalty, PrefScore, Session } from "./types";

/** Neutral defaults: no days off, no time bounds, sensible weights. */
export function defaultPrefs(): Prefs {
  return {
    daysOff: [],
    earliestStartMin: null,
    latestEndMin: null,
    maxGapMin: null,
    minWalkGapMin: null,
    weights: { dayOff: 10, early: 2, late: 2, gap: 1, walk: 3 },
  };
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function minutesOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 24 * 60) return Math.round(v);
  return undefined; // invalid: keep default
}

/** Lenient parse of untrusted JSON (string or object) into Prefs: bad fields fall back to defaults. Never throws. */
export function parsePrefs(raw: unknown): Prefs {
  const out = defaultPrefs();
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  const o = obj as Record<string, unknown>;

  if (Array.isArray(o.daysOff)) {
    const days = new Set<Day>();
    for (const d of o.daysOff) {
      if (typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6) days.add(d as Day);
    }
    out.daysOff = [...days].sort((a, b) => a - b);
  }
  for (const key of ["earliestStartMin", "latestEndMin", "maxGapMin", "minWalkGapMin"] as const) {
    const v = minutesOrNull(o[key]);
    if (v !== undefined) out[key] = v;
  }
  if (o.weights && typeof o.weights === "object" && !Array.isArray(o.weights)) {
    const w = o.weights as Record<string, unknown>;
    for (const key of ["dayOff", "early", "late", "gap", "walk"] as const) {
      const v = w[key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out.weights[key] = v;
    }
  }
  return out;
}

/** Building token from a location: text after "Bldg" or after the last "_". null when unknown. */
function building(loc: string | null): string | null {
  if (!loc) return null;
  const t = loc.trim();
  const b = /bldg\.?\s*([A-Za-z0-9-]+)/i.exec(t);
  if (b) return b[1].toLowerCase();
  const i = t.lastIndexOf("_");
  if (i >= 0 && i < t.length - 1) return t.slice(i + 1).trim().toLowerCase();
  return null;
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Placed {
  s: Session;
  campus: string | null;
}

/**
 * Score an allocation as a weekly pattern. Exempt sessions still count (the student attends them).
 * Gap and walk terms only compare sessions that share a teaching week. Points per unit: dayOff = per session on
 * the day, early/late = per 30 min outside the bound (rounded up), gap = per 30 min over the limit (rounded up),
 * walk = per building change. Lower is better.
 */
export function scorePrefs(alloc: Allocation, catalog: Catalog, prefs: Prefs): PrefScore {
  const penalties: PrefPenalty[] = [];
  const w = prefs.weights;
  const byDay = new Map<number, Placed[]>();
  for (const optionId of alloc.values()) {
    const opt = catalog.options.get(optionId);
    if (!opt) continue;
    for (const s of opt.sessions) {
      const list = byDay.get(s.day) ?? [];
      list.push({ s, campus: opt.campus });
      byDay.set(s.day, list);
    }
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const push = (kind: PrefPenalty["kind"], points: number, detail: string) => {
    if (points > 0) penalties.push({ kind, points, detail });
  };

  for (const day of days) {
    const list = byDay.get(day)!.sort((a, b) => a.s.startMin - b.s.startMin || a.s.endMin - b.s.endMin);
    const dn = DAY_NAMES[day];

    if (w.dayOff > 0 && prefs.daysOff.includes(day as Day)) {
      push(
        "dayOff",
        w.dayOff * list.length,
        `${dn} has ${list.length} session${list.length === 1 ? "" : "s"} but is a preferred day off`,
      );
    }
    for (const { s } of list) {
      if (w.early > 0 && prefs.earliestStartMin !== null && s.startMin < prefs.earliestStartMin) {
        const units = Math.ceil((prefs.earliestStartMin - s.startMin) / 30);
        push("early", w.early * units, `${dn} session starts ${hhmm(s.startMin)}, before ${hhmm(prefs.earliestStartMin)}`);
      }
      if (w.late > 0 && prefs.latestEndMin !== null && s.endMin > prefs.latestEndMin) {
        const units = Math.ceil((s.endMin - prefs.latestEndMin) / 30);
        push("late", w.late * units, `${dn} session ends ${hhmm(s.endMin)}, after ${hhmm(prefs.latestEndMin)}`);
      }
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if ((a.s.weeks & b.s.weeks) === 0) continue;
        const gap = b.s.startMin - a.s.endMin;
        if (gap < 0) continue;
        if (w.gap > 0 && prefs.maxGapMin !== null && gap > prefs.maxGapMin) {
          // Only the closest following session counts as "the next" one; skip if something sits between them.
          const between = list.slice(i + 1, j).some(
            (m) => (m.s.weeks & a.s.weeks & b.s.weeks) !== 0 && m.s.startMin < b.s.startMin,
          );
          if (!between) {
            const units = Math.ceil((gap - prefs.maxGapMin) / 30);
            push("gap", w.gap * units, `${dn} has a ${gap} min gap (${hhmm(a.s.endMin)} to ${hhmm(b.s.startMin)}), over ${prefs.maxGapMin} min`);
          }
        }
        if (w.walk > 0 && prefs.minWalkGapMin !== null && gap < prefs.minWalkGapMin) {
          const between = list.slice(i + 1, j).some(
            (m) => (m.s.weeks & a.s.weeks & b.s.weeks) !== 0 && m.s.startMin < b.s.startMin,
          );
          if (between) continue;
          const ba = building(a.s.location);
          const bb = building(b.s.location);
          const campusChange = a.campus !== null && b.campus !== null && a.campus !== b.campus;
          const buildingChange = ba !== null && bb !== null && ba !== bb;
          if (campusChange || buildingChange) {
            push(
              "walk",
              w.walk,
              `${dn} has only ${gap} min between ${hhmm(a.s.endMin)} (${campusChange ? a.campus : ba}) and ${hhmm(b.s.startMin)} (${campusChange ? b.campus : bb}), under ${prefs.minWalkGapMin} min to walk`,
            );
          }
        }
      }
    }
  }
  return { total: penalties.reduce((n, p) => n + p.points, 0), penalties };
}
