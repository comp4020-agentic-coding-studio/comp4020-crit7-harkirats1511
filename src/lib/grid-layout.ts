// Pure layout helpers for the focused grid. No DB or Astro imports.

export interface Span {
  startMin: number;
  endMin: number;
}

export interface LaneInfo {
  /** 0-based lane within the overlap cluster (and within the day). */
  lane: number;
  /** Number of lanes used by this block's overlap cluster. */
  clusterLanes: number;
}

/**
 * Interval-graph lane assignment. Blocks that (transitively) overlap form a cluster;
 * within a cluster each block takes the lowest lane that is free at its start.
 * Touching intervals (end === start) do not overlap. Result order matches input order.
 */
export function assignLanes(spans: readonly Span[]): LaneInfo[] {
  const order = spans
    .map((_, i) => i)
    .sort((a, b) => spans[a].startMin - spans[b].startMin || spans[a].endMin - spans[b].endMin || a - b);
  const out: LaneInfo[] = spans.map(() => ({ lane: 0, clusterLanes: 1 }));
  let cluster: number[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const i of cluster) out[i].clusterLanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const i of order) {
    const s = spans[i];
    if (cluster.length > 0 && s.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= s.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endMin);
    } else laneEnds[lane] = s.endMin;
    out[i].lane = lane;
    cluster.push(i);
    clusterEnd = cluster.length === 1 ? s.endMin : Math.max(clusterEnd, s.endMin);
  }
  flush();
  return out;
}

/** Maximum lanes needed by any cluster (>= 1). */
export function maxLanes(infos: readonly LaneInfo[]): number {
  return infos.reduce((m, i) => Math.max(m, i.clusterLanes), 1);
}

/** Axis in whole hours covering every span, padded by `padHours`; defaults to 8..18 when empty. */
export function fitAxis(spans: readonly Span[], padHours = 1): { startHour: number; endHour: number } {
  if (spans.length === 0) return { startHour: 8, endHour: 18 };
  const lo = Math.min(...spans.map((s) => s.startMin));
  const hi = Math.max(...spans.map((s) => s.endMin));
  return {
    startHour: Math.max(0, Math.floor(lo / 60) - padHours),
    endHour: Math.min(24, Math.ceil(hi / 60) + padHours),
  };
}

/** Zero-padded 24h time, e.g. 840 -> "14:00". */
export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type BlockKind = "yours" | "option" | "collides" | "ghost";

/** One drawn block in the grid (already filtered to the selected week). */
export interface GridBlock extends Span {
  key: string;
  kind: BlockKind;
  day: number;
  /** Primary text tag: Yours / Option / Collides / Ghost. */
  tag: string;
  /** Extra text tags: Full, Overflow, "Drop-in - never clashes". */
  extraTags: string[];
  dropIn: boolean;
  courseCode: string;
  /** e.g. "Tut A 04" (with " P2" for multi-part). */
  className: string;
  when: string;
  room: string;
  seats: string;
  weeks: string;
  /** Plain-text notes such as "Collides with COMP4020 Tut A 04". */
  notes: string[];
  /** null for blocks that are not links (ghosts). */
  href: string | null;
}

/** Minimum readable lane width in px. */
export const MIN_LANE_PX = 120;
/** Width of the time-of-day gutter in px (3.4rem at 16px, rounded). */
export const AXIS_PX = 56;

export interface DayTab {
  day: number;
  count: number;
  collides: boolean;
}

/** Per-day block counts and whether any block on that day is a collision. Ghosts count as blocks only when `countGhosts`. */
export function dayTabs(
  blocks: readonly { day: number; kind: BlockKind }[],
  days: readonly number[],
  countGhosts = false,
): DayTab[] {
  return days.map((day) => {
    const on = blocks.filter((b) => b.day === day && (countGhosts || b.kind !== "ghost"));
    return { day, count: on.length, collides: on.some((b) => b.kind === "collides") };
  });
}

/**
 * Day shown on phones: the requested day when it is one of `days`, else the first day with a
 * candidate/collision/held block, else the first day with any block, else the first day.
 */
export function pickDefaultDay(
  blocks: readonly { day: number; kind: BlockKind }[],
  days: readonly number[],
  requested: number | null,
): number {
  if (requested !== null && days.includes(requested)) return requested;
  const hot = days.find((d) => blocks.some((b) => b.day === d && (b.kind === "option" || b.kind === "collides")));
  if (hot !== undefined) return hot;
  const any = days.find((d) => blocks.some((b) => b.day === d));
  return any ?? days[0] ?? 0;
}

/** Minimum board width in px for the given per-day lane counts. */
export function minBoardPx(laneCounts: readonly number[]): number {
  return AXIS_PX + laneCounts.reduce((n, l) => n + Math.max(1, l), 0) * MIN_LANE_PX;
}

/** Indices of days that would fall off the right edge when only `availablePx` is visible. Empty when everything fits. */
export function daysBeyond(laneCounts: readonly number[], availablePx: number): number[] {
  if (minBoardPx(laneCounts) <= availablePx) return [];
  const out: number[] = [];
  let used = AXIS_PX;
  laneCounts.forEach((l, i) => {
    used += Math.max(1, l) * MIN_LANE_PX;
    if (used > availablePx) out.push(i);
  });
  return out;
}

/**
 * Can a block of this pixel height show its full detail (room, seats, weeks) without clipping?
 * Otherwise show the essential lines and keep the rest in the title / aria-label / list.
 */
export function blockDetail(heightPx: number, noteCount: number): "full" | "compact" {
  const lines = 8 + noteCount * 2;
  return heightPx >= lines * 14.4 + 10 ? "full" : "compact";
}

/**
 * Where a ghost (no lane of its own) should be drawn: the longest run of lanes with no laned block
 * overlapping it in time. Falls back to the whole day width (drawn behind) when every lane is busy.
 */
export function freeLaneRun(
  ghost: Span,
  laned: readonly Span[],
  lanes: readonly number[],
  laneCount: number,
): { from: number; count: number } {
  const busy = Array.from({ length: laneCount }, () => false);
  laned.forEach((b, i) => {
    if (b.startMin < ghost.endMin && ghost.startMin < b.endMin) busy[lanes[i]] = true;
  });
  let best = { from: 0, count: 0 };
  for (let i = 0; i < laneCount; ) {
    if (busy[i]) { i++; continue; }
    let j = i;
    while (j < laneCount && !busy[j]) j++;
    if (j - i > best.count) best = { from: i, count: j - i };
    i = j;
  }
  return best.count > 0 ? best : { from: 0, count: laneCount };
}
