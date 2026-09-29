import type {
  Allocation,
  Catalog,
  ClashDetail,
  Option,
  OptionState,
  SeatsUsed,
  Session,
  SessionClash,
} from "./types";

/** Overlap of two sessions (same day, overlapping minutes, shared week) or null. Adjacent (end == start) is no overlap. */
export function sessionOverlap(a: Session, b: Session): SessionClash | null {
  if (a.day !== b.day) return null;
  const from = Math.max(a.startMin, b.startMin);
  const to = Math.min(a.endMin, b.endMin);
  if (!(a.startMin < b.endMin && b.startMin < a.endMin) || to <= from) return null;
  const weeks = a.weeks & b.weeks;
  if (weeks === 0) return null;
  return { a, b, day: a.day, minutes: to - from, weeks, fromMin: from, toMin: to };
}

/**
 * Every clashing session pair between two options, or null. Null for the same option. A pair is skipped
 * when EITHER session is exempt (session.exempt or its group's exemptFromClash), so a drop-in bundled inside
 * an option never clashes, while the option's other sessions still can.
 */
export function optionClash(a: Option, b: Option, catalog: Catalog): ClashDetail | null {
  if (a.id === b.id) return null;
  const ga = catalog.groups.get(a.groupId);
  const gb = catalog.groups.get(b.groupId);
  const exA = ga?.exemptFromClash ?? false;
  const exB = gb?.exemptFromClash ?? false;
  if (exA || exB) return null;
  const overlaps: SessionClash[] = [];
  for (const sa of a.sessions) {
    if (sa.exempt) continue;
    for (const sb of b.sessions) {
      if (sb.exempt) continue;
      const o = sessionOverlap(sa, sb);
      if (o) overlaps.push(o);
    }
  }
  if (overlaps.length === 0) return null;
  overlaps.sort((x, y) => x.day - y.day || x.fromMin - y.fromMin || x.toMin - y.toMin);
  let weeks = 0;
  let totalMinutes = 0;
  for (const o of overlaps) {
    weeks |= o.weeks;
    totalMinutes += o.minutes;
  }
  return {
    optionA: a.id,
    optionB: b.id,
    groupA: a.groupId,
    groupB: b.groupId,
    overlaps,
    weeks,
    totalMinutes,
  };
}

/**
 * Clashes of `optionId` against the options in `alloc`, skipping the allocation entry for the
 * option's OWN group and any group in `ignoreGroupIds`. `optionA` of each result is `optionId`.
 */
export function clashesFor(
  optionId: string,
  alloc: Allocation,
  catalog: Catalog,
  ignoreGroupIds?: ReadonlySet<string>,
): ClashDetail[] {
  const opt = catalog.options.get(optionId);
  if (!opt) return [];
  const out: ClashDetail[] = [];
  for (const [groupId, otherId] of alloc) {
    if (groupId === opt.groupId || ignoreGroupIds?.has(groupId)) continue;
    const other = catalog.options.get(otherId);
    if (!other) continue;
    const c = optionClash(opt, other, catalog);
    if (c) out.push(c);
  }
  return out;
}

/** All clashes among the options in `alloc` (each unordered pair once). Used by dashboard and autofix. */
export function allClashes(alloc: Allocation, catalog: Catalog): ClashDetail[] {
  const entries = [...alloc.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  const out: ClashDetail[] = [];
  for (let i = 0; i < entries.length; i++) {
    const a = catalog.options.get(entries[i][1]);
    if (!a) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = catalog.options.get(entries[j][1]);
      if (!b || a.groupId === b.groupId) continue;
      const c = optionClash(a, b, catalog);
      if (c) out.push(c);
    }
  }
  return out;
}

/**
 * State of every option in `groupId` for this allocation. The student's own current option is
 * "yours" and is never full (they already hold a seat). Precedence: yours > clash > full > select.
 * `capacity: null` is never full and has `seatsLeft: null`.
 */
export function optionStates(
  groupId: string,
  alloc: Allocation,
  catalog: Catalog,
  seats: SeatsUsed,
): Map<string, OptionState> {
  const out = new Map<string, OptionState>();
  const group = catalog.groups.get(groupId);
  if (!group) return out;
  const current = alloc.get(groupId);
  for (const opt of group.options) {
    const used = seats.get(opt.id) ?? 0;
    const seatsLeft = opt.capacity === null ? null : Math.max(0, opt.capacity - used);
    const isYours = current === opt.id;
    const full = !isYours && opt.capacity !== null && used >= opt.capacity;
    const clashes = isYours ? [] : clashesFor(opt.id, alloc, catalog);
    const kind = isYours ? "yours" : clashes.length > 0 ? "clash" : full ? "full" : "select";
    out.set(opt.id, { optionId: opt.id, kind, seatsLeft, full, clashes });
  }
  return out;
}
