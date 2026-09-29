import type { Allocation, Catalog, Term } from "./types";

export interface IcsOptions {
  /** Calendar name (X-WR-CALNAME). */
  calName?: string;
  /** DTSTAMP source; default new Date(). Injected for deterministic tests. */
  now?: Date;
}

/**
 * RFC 5545 calendar for the allocation: one VEVENT per session per running week (no RRULE, so the break is
 * correct), local Australia/Sydney times, CRLF line endings, 75-octet folding, stable UIDs.
 */
export function buildIcs(alloc: Allocation, catalog: Catalog, term: Term, opts?: IcsOptions): string {
  throw new Error("not implemented: buildIcs");
}
