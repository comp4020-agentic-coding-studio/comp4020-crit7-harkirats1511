import type { Allocation, Catalog, Prefs, PrefScore } from "./types";

/** Neutral defaults: no days off, no time bounds, all weights off except sensible defaults. */
export function defaultPrefs(): Prefs {
  throw new Error("not implemented: defaultPrefs");
}

/** Validate/normalise untrusted JSON (from DB or form) into Prefs; throws on invalid shape. */
export function parsePrefs(raw: unknown): Prefs {
  throw new Error("not implemented: parsePrefs");
}

/** Score an allocation (weekly pattern, any week): days off, early/late, gaps, building-to-building walks. Lower is better. */
export function scorePrefs(alloc: Allocation, catalog: Catalog, prefs: Prefs): PrefScore {
  throw new Error("not implemented: scorePrefs");
}
